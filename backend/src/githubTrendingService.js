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
 * Fetches GitHub trending repos for the given timeframe.
 * @param {"daily"|"weekly"|"monthly"} since
 */
async function fetchTrending(since = "daily") {
  const client = createHttpClient({ timeout: 15000, retries: 2 });

  const url = `${GITHUB_TRENDING_URL}?since=${since}`;
  const res = await client.get(url, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (compatible; TrendPulse/2.0; +https://github.com/trendpulse)",
    },
  });

  const repos = parseRepos(res.data);
  logger.info(`GitHub Trending: fetched ${repos.length} repos (since=${since})`);
  return repos;
}

module.exports = { fetchTrending, parseRepos };
