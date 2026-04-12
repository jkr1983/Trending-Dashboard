const { createHttpClient } = require("./httpClient");
const logger = require("./logger");

const YT_BASE = "https://www.googleapis.com/youtube/v3";
const MAX_RESULTS = 15; // expanded from 10
const REGION = "US";    // used for both the search regionCode and the isPlayable region-restriction check

// Parts requested from videos.list. EACH PART IS LOAD-BEARING for isPlayable():
//   - snippet        → title, channel, thumbnails, description (for UI)
//   - statistics     → viewCount presence check (rights-gated filter)
//                      AND view/like counts (for UI + sort)
//   - status         → uploadStatus + privacyStatus checks
//   - contentDetails → regionRestriction.blocked / .allowed checks
// Do NOT trim this list without also updating isPlayable() — dropping a part
// will silently turn its associated filter rule into a no-op.
const VIDEO_PARTS = "snippet,statistics,status,contentDetails";

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
 * Returns true if a raw YouTube video item is playable via its public watch URL.
 *
 * Excludes videos that:
 *   - Are missing id/snippet (malformed response)
 *   - Aren't fully processed (uploadStatus ≠ "processed" → deleted/failed/rejected)
 *   - Aren't public (privacyStatus ≠ "public" → private/unlisted)
 *   - Are region-blocked in our target region (US)
 *   - Have an allow-list that excludes our target region
 *   - Are missing `statistics.viewCount` — reliable signal the video is
 *     rights-gated or otherwise unavailable for playback even though the
 *     Data API reports it as public. Observed on ESPN / NFL-style broadcasts
 *     where videos.list returns `statistics: { favoriteCount: "0" }` (no
 *     viewCount key) and the watch page returns
 *     `playabilityStatus: { status: "ERROR", reason: "Video unavailable" }`.
 *     Note: genuinely fresh uploads with zero views still have the
 *     `viewCount` key present with value "0", so this check won't drop them.
 *
 * Videos returned by search.list but absent from videos.list are implicitly
 * filtered (deleted or made private between the two calls).
 */
function isPlayable(item) {
  if (!item || !item.id || !item.snippet) return false;

  const status = item.status || {};
  if (status.uploadStatus && status.uploadStatus !== "processed") return false;
  if (status.privacyStatus && status.privacyStatus !== "public") return false;

  // Missing viewCount key → rights-gated or unavailable for playback.
  // We intentionally check key presence, not value, so a legit "0"-view
  // fresh upload still passes.
  const stats = item.statistics;
  if (!stats || stats.viewCount === undefined || stats.viewCount === null) {
    return false;
  }

  const restriction = item.contentDetails?.regionRestriction;
  if (restriction) {
    if (Array.isArray(restriction.blocked) && restriction.blocked.includes(REGION)) {
      return false;
    }
    if (Array.isArray(restriction.allowed) && !restriction.allowed.includes(REGION)) {
      return false;
    }
  }

  return true;
}

/**
 * Normalises a raw YouTube video item into the shape consumed by the frontend.
 * Handles missing/null fields gracefully as defence-in-depth — in the normal
 * flow, items reach this function only after passing `isPlayable()`, so the
 * statistics / snippet fields should already be present.
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
 *   Pass 1 — search.list with `publishedAfter = now − 24h`, sorted by
 *            viewCount. Returns video IDs only (cheap API cost).
 *   Pass 2 — videos.list to fetch full `VIDEO_PARTS` for those IDs so we
 *            can filter with `isPlayable()` and render full cards.
 *
 * Falls back to the `chart=mostPopular` path (no date filter) when search
 * returns fewer than 5 IDs — some niche categories have thin 24h coverage
 * and we'd rather show yesterday's popular videos than an empty section.
 *
 * The `isPlayable()` filter is applied on BOTH paths, before normalisation,
 * so unplayable videos (private, deleted, region-blocked, rights-gated) are
 * dropped in every code path. Dropped counts are logged at info level so
 * you can see filter activity in `backend/logs/`.
 *
 * Errors are swallowed and return `[]` so one bad category doesn't take
 * down the whole dashboard — except 403 (quota/key) which re-throws because
 * every category will hit the same wall.
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
      regionCode: REGION,
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
          part: VIDEO_PARTS,
          id: videoIds.join(","),
          key: apiKey,
        },
      });

      const rawItems = detailRes.data?.items || [];
      const playable = rawItems.filter(isPlayable);
      const droppedCount = rawItems.length - playable.length;
      if (droppedCount > 0) {
        logger.info(
          `YouTube: dropped ${droppedCount} unplayable video(s) in "${catName}"`
        );
      }

      // Sort by viewCount descending (search order isn't guaranteed)
      videos = playable
        .map(normalizeVideo)
        .filter(Boolean)
        .sort((a, b) => b.views - a.views);

    } else {
      // ── Fallback: mostPopular chart (no date filter) ────────────────────
      logger.warn(
        `YouTube: insufficient 24h results for "${catName}" (${videoIds.length}), falling back to mostPopular`
      );
      const fallbackParams = {
        part: VIDEO_PARTS,
        chart: "mostPopular",
        regionCode: REGION,
        maxResults: MAX_RESULTS,
        key: apiKey,
      };
      if (catId !== "0") fallbackParams.videoCategoryId = catId;

      const fallbackRes = await client.get(`${YT_BASE}/videos`, { params: fallbackParams });
      const rawItems = fallbackRes.data?.items || [];
      const playable = rawItems.filter(isPlayable);
      const droppedCount = rawItems.length - playable.length;
      if (droppedCount > 0) {
        logger.info(
          `YouTube: dropped ${droppedCount} unplayable video(s) in "${catName}" fallback`
        );
      }
      videos = playable.map(normalizeVideo).filter(Boolean);
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

module.exports = { fetchAllCategories, normalizeVideo, isPlayable, validateApiKey, YT_CATEGORIES };
