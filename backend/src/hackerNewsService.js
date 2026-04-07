const { createHttpClient } = require("./httpClient");
const logger = require("./logger");

const HN_BASE = "https://hacker-news.firebaseio.com/v0";
const TOP_N = 15;

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
 * Fetches top HN stories. No API key required.
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
