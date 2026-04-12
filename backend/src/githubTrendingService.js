const { createHttpClient } = require("./httpClient");
const logger = require("./logger");

const GITHUB_TRENDING_URL = "https://github.com/trending";

/**
 * Parses trending repo HTML into structured objects.
 * GitHub Trending has no official API, so we scrape the public page.
 */
function parseRepos(html) {
  const repos = [];

  // Match each repo article block
  const articleRegex = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
  let articleMatch;
  let rank = 0;

  while ((articleMatch = articleRegex.exec(html)) !== null) {
    rank++;
    const block = articleMatch[1];

    // Repo full name (owner/repo)
    const nameMatch = block.match(/href="\/([^/]+\/[^/"]+)"/);
    const fullName = nameMatch ? nameMatch[1] : null;
    if (!fullName) continue;

    const [owner, repoName] = fullName.split("/");

    // Description
    const descMatch = block.match(/<p[^>]*class="[^"]*color-fg-muted[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/p>/);
    const description = descMatch
      ? descMatch[1].replace(/\s+/g, " ").replace(/&amp;/g, "&").trim()
      : "";

    // Language
    const langMatch = block.match(/itemprop="programmingLanguage"[^>]*>\s*([^<]+)\s*<\/span>/);
    const language = langMatch ? langMatch[1].trim() : null;

    // Stars (total)
    const starsMatch = block.match(/href="\/[^"]+\/stargazers"[^>]*>\s*[\s\S]*?([\d,]+)\s*<\/a>/);
    const stars = starsMatch ? parseInt(starsMatch[1].replace(/,/g, ""), 10) : 0;

    // Forks
    const forksMatch = block.match(/href="\/[^"]+\/forks"[^>]*>\s*[\s\S]*?([\d,]+)\s*<\/a>/);
    const forks = forksMatch ? parseInt(forksMatch[1].replace(/,/g, ""), 10) : 0;

    // Stars today
    const todayMatch = block.match(/([\d,]+)\s+stars today/i);
    const starsToday = todayMatch ? parseInt(todayMatch[1].replace(/,/g, ""), 10) : 0;

    repos.push({
      rank,
      fullName,
      owner,
      name: repoName,
      description,
      language,
      stars,
      forks,
      starsToday,
      url: `https://github.com/${fullName}`,
    });
  }

  return repos;
}

/**
 * Fetches GitHub trending repos for a single timeframe.
 * @param {"daily"|"weekly"|"monthly"} since
 * @returns {Promise<Array>} parsed repo list (may be empty on error)
 */
async function fetchTrending(since = "daily") {
  const client = createHttpClient({ timeout: 15000, retries: 2 });

  const url = `${GITHUB_TRENDING_URL}?since=${since}`;
  const res = await client.get(url, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (compatible; TrendPulse/3.4; +https://github.com/trendpulse)",
    },
  });

  const repos = parseRepos(res.data);
  logger.info(`GitHub Trending: fetched ${repos.length} repos (since=${since})`);
  return repos;
}

/**
 * Fetches all three GitHub trending ranges in parallel and returns them as a
 * single object. This matches the v3.3 "fetch wide super-set, filter client-
 * side" pattern used for YouTube — the frontend's time-frame dropdown picks
 * which bucket to display without triggering any additional network calls.
 *
 * GitHub's trending HTML scrape does NOT include per-repo publish timestamps
 * (the only date-ish signal is "N stars today"). That's why we can't run a
 * single-list client-side date filter like we do for HN or Dev.to — instead
 * we pre-fetch the three buckets GitHub itself offers.
 *
 * If a single bucket fails, the other two still succeed — failures return an
 * empty array for that bucket so the frontend can fall back gracefully.
 */
async function fetchAllRanges() {
  const ranges = ["daily", "weekly", "monthly"];
  const results = await Promise.allSettled(ranges.map(fetchTrending));

  const buckets = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      buckets[ranges[i]] = r.value;
    } else {
      logger.error(`GitHub Trending: failed to fetch ${ranges[i]}`, {
        message: r.reason?.message,
      });
      buckets[ranges[i]] = [];
    }
  });

  return buckets;
}

module.exports = { fetchTrending, fetchAllRanges, parseRepos };
