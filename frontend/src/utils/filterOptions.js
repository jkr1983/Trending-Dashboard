// Shared filter-dropdown options used by YouTube, HackerNews, GitHubTrending,
// and DevTo pages. Keeping these in one place means every source offers the
// same UX — same time-frame choices, same count choices, same defaults —
// even though each source applies them differently under the hood.
//
// ── Per-source filter semantics ─────────────────────────────────────────────
//   YouTube   — client-side filter on video.publishedAt over a pre-fetched
//               21-day super-set (50 videos per category).
//   HackerNews — client-side filter on story.time over a pre-fetched 100-story
//               super-set. HN's "top" list is usually within a day or two,
//               so picks past ~3 days will typically return the full list.
//   GitHub    — GitHub Trending's HTML scrape has no per-repo publish date.
//               Instead the backend pre-fetches daily / weekly / monthly
//               buckets and the dropdown picks which bucket to show:
//                 1 day           → daily
//                 2 or 3 days     → weekly
//                 5 / 10 / 20 day → monthly
//               This is still "instant" (no additional fetch) but lossier
//               than the other sources — 20 days and 10 days show the same
//               monthly bucket.
//   Dev.to    — client-side filter on article.publishedAt over a pre-fetched
//               top=30 / per_page=50 super-set.
//
// ── Backend caps ────────────────────────────────────────────────────────────
// Any option added here must satisfy the backend's outer guardrails:
//   - YouTube:    MAX_AGE_MS = 21 days, MAX_RESULTS = 50
//   - HackerNews: TOP_N = 100
//   - Dev.to:     TOP_DAYS = 30, PER_PAGE = 50
// If you widen these options, widen the backend constants first or the pick
// will silently return empty or truncated lists.

export const TIME_FRAME_OPTIONS = [
  { days: 1,  label: "Past 1 day"   },
  { days: 2,  label: "Past 2 days"  },
  { days: 3,  label: "Past 3 days"  },
  { days: 5,  label: "Past 5 days"  },
  { days: 10, label: "Past 10 days" },
  { days: 20, label: "Past 20 days" },
];

export const COUNT_OPTIONS = [5, 10, 15, 20, 25, 50];

export const DEFAULT_TIME_FRAME_DAYS = 1;
export const DEFAULT_COUNT           = 15;

/**
 * Filters an array of items by `publishedAtField` (ISO string) newer than
 * the given time-frame window, then slices to `count`.
 *
 * @param {Array}  items     the pre-fetched super-set
 * @param {number} days      the selected time-frame in days
 * @param {number} count     the selected slice count
 * @param {string} dateField the name of the ISO timestamp field on each item
 *                           (e.g. "publishedAt" for YouTube/Dev.to, "time"
 *                           for HackerNews)
 */
export function applyTimeAndCountFilter(items, days, count, dateField = "publishedAt") {
  if (!Array.isArray(items) || items.length === 0) return [];
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  return items
    .filter((item) => {
      const raw = item?.[dateField];
      if (!raw) return false;
      const ts = Date.parse(raw);
      return !Number.isNaN(ts) && ts >= cutoffMs;
    })
    .slice(0, count);
}

/**
 * Formats the time-frame selection into the "Past N day(s)" label for the
 * section badge. Used by every source page that renders the filter badge.
 */
export function timeFrameLabel(days) {
  const opt = TIME_FRAME_OPTIONS.find((o) => o.days === days);
  return opt ? opt.label : `Past ${days} days`;
}
