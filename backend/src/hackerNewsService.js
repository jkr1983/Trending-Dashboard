const { createHttpClient } = require("./httpClient");
const logger = require("./logger");

const HN_BASE = "https://hacker-news.firebaseio.com/v0";
// Fetch a wide super-set so the frontend can filter client-side by time frame
// (1/2/3/5/10/20 days) and count (5/10/15/20/25/50) without re-fetching. HN's
// topstories endpoint returns ~500 story IDs but we cap at 100 — that's more
// than enough to satisfy the widest dropdown pick and keeps item fetches fast.
const TOP_N = 100;

/**
 * Normalises a raw HN item into a clean object.
 */
function normalizeStory(item, rank) {
  if (!item || !item.id || item.type !== "story") return null;
  return {
    id: item.id,
    rank,
    title: item.title || "Untitled",
    url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    commentsUrl: `https://news.ycombinator.com/item?id=${item.id}`,
    score: item.score || 0,
    by: item.by || "unknown",
    descendants: item.descendants || 0,
    time: item.time ? new Date(item.time * 1000).toISOString() : null,
    domain: item.url ? extractDomain(item.url) : "news.ycombinator.com",
  };
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Fetches up to `TOP_N` (100) HN stories from the top-stories endpoint.
 * Runs two passes: the first gets the ordered list of story IDs, the second
 * fetches each item in parallel. Individual item fetch failures are logged
 * and dropped (the story is just missing from the result); the top-level
 * topstories endpoint failing throws, because without IDs we can't do
 * anything useful.
 *
 * The frontend filters this super-set client-side by `story.time` so the
 * user's time-frame dropdown works without any additional network calls.
 * No API key required.
 */
async function fetchTopStories() {
  const client = createHttpClient({ timeout: 12000, retries: 2 });

  // Step 1: get top story IDs
  const idsRes = await client.get(`${HN_BASE}/topstories.json`);
  const ids = (idsRes.data || []).slice(0, TOP_N);

  if (!ids.length) {
    logger.warn("HackerNews: no story IDs returned");
    return [];
  }

  // Step 2: fetch each item in parallel
  const items = await Promise.all(
    ids.map(async (id, rank) => {
      try {
        const res = await client.get(`${HN_BASE}/item/${id}.json`);
        return normalizeStory(res.data, rank + 1);
      } catch (err) {
        logger.error(`HackerNews: failed to fetch item ${id}`, { message: err.message });
        return null;
      }
    })
  );

  const stories = items.filter(Boolean);
  logger.info(`HackerNews: fetched ${stories.length} stories`);
  return stories;
}

module.exports = { fetchTopStories, normalizeStory };
