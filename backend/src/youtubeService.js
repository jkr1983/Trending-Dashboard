const { createHttpClient } = require("./httpClient");
const logger = require("./logger");

const YT_BASE = "https://www.googleapis.com/youtube/v3";

const YT_CATEGORIES = {
  "0":  "All",
  "10": "Music",
  "15": "Pets & Animals",
  "17": "Sports",
  "20": "Gaming",
  "22": "People & Blogs",
  "23": "Comedy",
  "24": "Entertainment",
  "25": "News & Politics",
  "26": "How-to & Style",
  "28": "Science & Technology",
};

/**
 * Validates that a YouTube API key is present and non-empty.
 */
function validateApiKey(key) {
  if (!key || typeof key !== "string" || key.trim() === "") {
    throw new Error("YouTube API key is missing or invalid");
  }
}

/**
 * Normalises a raw YouTube video item into a clean object.
 * Handles missing/null fields gracefully.
 */
function normalizeVideo(item) {
  if (!item || !item.id || !item.snippet) return null;
  return {
    id: item.id,
    title: item.snippet.title || "Untitled",
    channel: item.snippet.channelTitle || "Unknown Channel",
    thumbnail:
      item.snippet.thumbnails?.high?.url ||
      item.snippet.thumbnails?.medium?.url ||
      item.snippet.thumbnails?.default?.url ||
      null,
    views: parseInt(item.statistics?.viewCount ?? 0, 10),
    likes: parseInt(item.statistics?.likeCount ?? 0, 10),
    publishedAt: item.snippet.publishedAt || null,
    url: `https://www.youtube.com/watch?v=${item.id}`,
    description: item.snippet.description
      ? item.snippet.description.slice(0, 120) + "…"
      : "",
  };
}

/**
 * Fetches trending videos for a single category.
 * Returns empty array on failure so other categories still load.
 */
async function fetchCategory(client, apiKey, catId, catName) {
  try {
    const params = {
      part: "snippet,statistics",
      chart: "mostPopular",
      regionCode: "US",
      maxResults: 10,
      key: apiKey,
    };
    if (catId !== "0") params.videoCategoryId = catId;

    const res = await client.get(`${YT_BASE}/videos`, { params });

    const videos = (res.data?.items || [])
      .map(normalizeVideo)
      .filter(Boolean);

    logger.info(`YouTube: fetched ${videos.length} videos for "${catName}"`);
    return videos;
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.error?.message || err.message;

    if (status === 403) {
      logger.error(`YouTube quota exceeded or key invalid for category "${catName}"`, { status, message });
      throw new Error(`YouTube API error (403): ${message}`);
    }

    logger.error(`YouTube fetch failed for category "${catName}"`, { status, message });
    return []; // Graceful degradation — other categories still load
  }
}

/**
 * Fetches all trending video categories.
 * Throws only on fatal errors (bad key, quota); partial failures return empty arrays.
 */
async function fetchAllCategories(apiKey) {
  validateApiKey(apiKey);
  const client = createHttpClient({ timeout: 12000, retries: 3 });
  const results = {};

  // Run all category fetches in parallel, cap concurrency via Promise.all
  const entries = Object.entries(YT_CATEGORIES);
  const fetched = await Promise.all(
    entries.map(([id, name]) => fetchCategory(client, apiKey, id, name))
  );

  entries.forEach(([, name], i) => {
    results[name] = fetched[i];
  });

  return results;
}

module.exports = { fetchAllCategories, normalizeVideo, validateApiKey, YT_CATEGORIES };
