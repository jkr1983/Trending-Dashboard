const { createHttpClient } = require("./httpClient");
const logger = require("./logger");

const YT_BASE = "https://www.googleapis.com/youtube/v3";
// We fetch a wide super-set so the frontend can filter client-side to any
// window the user picks from the dropdown (1/2/3/5/10/20 days) and any count
// they pick (5/10/15/20/25/50) without triggering a new API call per change.
// 50 is the max YouTube allows for both `search.list?maxResults` and
// `videos.list?id=...` in one call, so this is the widest single-request set.
const MAX_RESULTS = 50;
const REGION = "US";    // used for both the search regionCode and the isPlayable region-restriction check

// Outer recency guardrail. The frontend time-frame dropdown maxes out at
// 20 days; we fetch 21 days so the user's largest pick always has fresh data
// even if YouTube's `publishedAfter` is fuzzy at the edge. Anything older
// than this is dropped before reaching the frontend — it would be unreachable
// via the UI anyway.
//
// Historical context: this was 26h in v3.2 when the UI promised a strict
// "Past 24h" view. v3.3 introduced user-selectable windows, so the backend
// guardrail moved out to 21 days and the frontend does the fine-grained
// filter. The 1-day extra slack still absorbs YouTube `publishedAfter`
// fuzziness and the 30-min cache TTL.
const MAX_AGE_MS = 21 * 24 * 60 * 60 * 1000;

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
 * Returns an ISO 8601 timestamp for the `publishedAfter` parameter on
 * `search.list`. Matches `MAX_AGE_MS` so the search and the local recency
 * filter use the same outer boundary.
 *
 * The frontend time-frame dropdown then picks any window ≤ this for display.
 */
function getPublishedAfterCutoff() {
  return new Date(Date.now() - MAX_AGE_MS).toISOString();
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
 * Returns true if a raw YouTube video item was published within the
 * backend's outer recency guardrail (`MAX_AGE_MS`) relative to `nowMs`
 * (defaults to the current time).
 *
 * This function is the backend's outer fence — it does NOT enforce the
 * user's dropdown selection. The frontend applies a finer filter
 * (1/2/3/5/10/20 days) on top of the backend's response. This function's
 * job is only to make sure absolutely-stale content (week-old mostPopular
 * fallback leaks, etc.) doesn't reach the frontend at all.
 *
 * Why it's not a trusted "publishedAfter" replacement on YouTube's side:
 *  - `search.list?publishedAfter` is fuzzy at the boundary
 *  - The `mostPopular` fallback chart has no date filter
 *
 * `nowMs` is injected for testability — production callers pass `Date.now()`.
 * Returns false for items with missing or unparseable `publishedAt`.
 */
function isRecent(item, nowMs = Date.now()) {
  const pa = item?.snippet?.publishedAt;
  if (!pa) return false;
  const ts = Date.parse(pa);
  if (Number.isNaN(ts)) return false;
  return (nowMs - ts) <= MAX_AGE_MS;
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
 * Two filters are applied on BOTH paths, in order, before normalisation:
 *   1. `isPlayable()` — drops private/deleted/region-blocked/rights-gated.
 *   2. `isRecent()`   — drops anything outside the `MAX_AGE_MS` outer
 *                        guardrail (21 days). This is the BACKEND's fence;
 *                        the frontend applies a finer user-selected filter
 *                        (1/2/3/5/10/20 days) on top. Especially important
 *                        for the fallback path, which has no date filter
 *                        on the YouTube side and would otherwise leak
 *                        month-old videos.
 *
 * Dropped counts are logged at info level for each filter so you can see
 * filter activity in `backend/logs/combined.log`.
 *
 * Errors are swallowed and return `[]` so one bad category doesn't take
 * down the whole dashboard — except 403 (quota/key) which re-throws because
 * every category will hit the same wall.
 */
async function fetchCategory(client, apiKey, catId, catName) {
  try {
    const publishedAfter = getPublishedAfterCutoff();
    // Single `now` anchor for every recency check in this call, so that
    // items fetched ~milliseconds apart aren't judged against different
    // cutoffs.
    const nowMs = Date.now();

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
      const recent   = playable.filter((it) => isRecent(it, nowMs));
      const droppedUnplayable = rawItems.length - playable.length;
      const droppedStale      = playable.length - recent.length;
      if (droppedUnplayable > 0) {
        logger.info(
          `YouTube: dropped ${droppedUnplayable} unplayable video(s) in "${catName}"`
        );
      }
      if (droppedStale > 0) {
        logger.info(
          `YouTube: dropped ${droppedStale} out-of-window video(s) in "${catName}" (>21d old)`
        );
      }

      // Sort by viewCount descending (search order isn't guaranteed)
      videos = recent
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
      // The fallback chart (`mostPopular`) has no date filter on the YouTube
      // side, so we MUST apply the local recency cutoff here — otherwise
      // niche categories leak week-old videos into the "Past 24h" list.
      const recent   = playable.filter((it) => isRecent(it, nowMs));
      const droppedUnplayable = rawItems.length - playable.length;
      const droppedStale      = playable.length - recent.length;
      if (droppedUnplayable > 0) {
        logger.info(
          `YouTube: dropped ${droppedUnplayable} unplayable video(s) in "${catName}" fallback`
        );
      }
      if (droppedStale > 0) {
        logger.info(
          `YouTube: dropped ${droppedStale} out-of-window video(s) in "${catName}" fallback (>21d old)`
        );
      }
      videos = recent.map(normalizeVideo).filter(Boolean);
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

module.exports = {
  fetchAllCategories,
  normalizeVideo,
  isPlayable,
  isRecent,
  validateApiKey,
  YT_CATEGORIES,
  MAX_AGE_MS,
};
