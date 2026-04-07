const { createHttpClient } = require("./httpClient");
const logger = require("./logger");

const YT_BASE = "https://www.googleapis.com/youtube/v3";
const MAX_RESULTS = 15; // expanded from 10

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
 * Returns an ISO 8601 timestamp for 24 hours ago.
 * Used to filter videos published in the last day.
 */
function get24HoursAgo() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
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
 * Fetches trending videos for a single category using a two-pass strategy:
 *
 * Pass 1 — search/list with publishedAfter to find videos from the past 24h,
 *           sorted by viewCount. Returns video IDs.
 * Pass 2 — videos.list to fetch full snippet + statistics for those IDs.
 *
 * Falls back to mostPopular chart (no date filter) if the search returns
 * fewer than 5 results (some niche categories have thin 24h coverage).
 */
async function fetchCategory(client, apiKey, catId, catName) {
  try {
    const publishedAfter = get24HoursAgo();

    // ── Pass 1: search for recent videos in this category ──────────────────
    const searchParams = {
      part: "id",
      type: "video",
      order: "viewCount",
      publishedAfter,
      maxResults: MAX_RESULTS,
      regionCode: "US",
      relevanceLanguage: "en",
      key: apiKey,
    };
    if (catId !== "0") searchParams.videoCategoryId = catId;

    const searchRes = await client.get(`${YT_BASE}/search`, { params: searchParams });
    const videoIds = (searchRes.data?.items || [])
      .map((item) => item.id?.videoId)
      .filter(Boolean);

    let videos = [];

    if (videoIds.length >= 5) {
      // ── Pass 2: fetch full details for found IDs ────────────────────────
      const detailRes = await client.get(`${YT_BASE}/videos`, {
        params: {
          part: "snippet,statistics",
          id: videoIds.join(","),
          key: apiKey,
        },
      });

      // Sort by viewCount descending (search order isn't guaranteed)
      videos = (detailRes.data?.items || [])
        .map(normalizeVideo)
        .filter(Boolean)
        .sort((a, b) => b.views - a.views);

    } else {
      // ── Fallback: mostPopular chart (no date filter) ────────────────────
      logger.warn(
        `YouTube: insufficient 24h results for "${catName}" (${videoIds.length}), falling back to mostPopular`
      );
      const fallbackParams = {
        part: "snippet,statistics",
        chart: "mostPopular",
        regionCode: "US",
        maxResults: MAX_RESULTS,
        key: apiKey,
      };
      if (catId !== "0") fallbackParams.videoCategoryId = catId;

      const fallbackRes = await client.get(`${YT_BASE}/videos`, { params: fallbackParams });
      videos = (fallbackRes.data?.items || [])
        .map(normalizeVideo)
        .filter(Boolean);
    }

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
  const client = createHttpClient({ timeout: 15000, retries: 3 });
  const results = {};

  // Run all category fetches in parallel
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
