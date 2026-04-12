# TrendPulse — Changelog

## v3.2 — YouTube Past-24h Enforcement (2026-04-11)

### Problem
The "Trending · Past 24h" badge was aspirational, not enforced. A live
audit of the API right after v3.1 shipped showed that out of **161
videos returned** across all categories, **only 18** were actually
from the past 24 hours. Some categories (Music, Pets & Animals,
Comedy, Entertainment, Science & Technology) had **zero** videos
within the window — the oldest "trending" video was ~12 days old.

Two root causes:

1. **The `mostPopular` fallback chart has no date filter.** When
   `search.list` returned fewer than 5 recent videos for a niche
   category, we fell back to the most-popular chart and silently
   pulled week-old and month-old videos into the "Past 24h" list.
2. **`search.list?publishedAfter` is fuzzy.** Even on the primary
   path, YouTube occasionally returned videos 5–10 hours past the
   boundary we asked for.

### Fix
Added `isRecent(item, nowMs)` and a `MAX_AGE_MS = 26 * 60 * 60 * 1000`
constant to `backend/src/youtubeService.js`. The filter runs locally
on every video from both the primary and fallback paths, after
`isPlayable()`, before normalisation and sorting. The window is
**26 hours** (not 24) to absorb:

- YouTube `search.list` fuzziness at the boundary
- The 30-minute cache TTL (a video that was 23.8h old when fetched
  would otherwise be 24.3h old at the end of its cache lifetime)

The `nowMs` parameter is injected for deterministic testing — production
callers pass `Date.now()`. Dropped-by-age counts are logged separately
from dropped-by-unplayable counts so `backend/logs/combined.log` lets
you see which filter is doing the work per category per refresh.

### User-visible behaviour
- The "Past 24h" badge is now **honest**. If the API says a video is
  older than 26h, it is not in the dashboard.
- Niche categories that genuinely lack 24h trending content now
  display `"No videos found for this category."` — "Option A" per
  the design discussion. This was chosen over relabeling fallback
  tabs as "Popular" to avoid frontend complexity for a rare case.
- Expect to see categories with visibly thinner video counts,
  especially for non-peak hours.

### Tests
`backend/tests/youtubeService.test.js` grew from 39 → 52 tests:

- 10 new `isRecent()` unit tests covering 5h/25h/26h-boundary/27h/10-day
  cases, missing `publishedAt`, unparseable `publishedAt`, null input,
  and deterministic `nowMs` injection
- 3 new `fetchAllCategories` integration tests for the recency filter
  on the primary path, fallback path, and the all-stale-category case
  (Option A — empty result, no silent fallback to old content)

### Config knob
If you need to widen the window in the future (e.g. for timezones
where "trending" operates on a different clock), edit `MAX_AGE_MS`
at the top of `backend/src/youtubeService.js`. That constant is
exported from the module so tests can assert on it.

---

## v3.1 — YouTube Playability Filter (2026-04-11)

### Problem
Videos occasionally appeared in the dashboard with broken watch links.
Root cause: the YouTube Data API reports certain rights-gated broadcasts
(ESPN, NFL, PGA) as `privacyStatus: public`, `uploadStatus: processed`,
and `embeddable: true` with no region restriction — but the watch page
itself returns `playabilityStatus: { status: "ERROR", reason: "Video
unavailable" }`. The concrete trigger was an ESPN "Second Round" golf
broadcast (id `kx7VwFiRPVk`).

### Fix
Added `isPlayable()` to `backend/src/youtubeService.js`, applied on both
the primary `search → videos.list` path **and** the `mostPopular`
fallback path. The filter excludes items that are:

- missing `id` or `snippet` (malformed)
- `status.uploadStatus !== "processed"` (deleted/failed/rejected)
- `status.privacyStatus !== "public"` (private/unlisted)
- missing the `statistics.viewCount` **key** (rights-gated broadcasts —
  key-presence check, not value, so zero-view fresh uploads still pass)
- US-region-blocked via `contentDetails.regionRestriction.blocked`
- allow-listed to regions that exclude US via `.allowed`

The `videos.list` `part` parameter was widened to
`"snippet,statistics,status,contentDetails"` (exported as the
`VIDEO_PARTS` constant) so the filter has the data it needs. Dropped
counts are logged at `info` level with the category name.

### Tests
`backend/tests/youtubeService.test.js` grew from 23 → 39 tests:

- 10 new `isPlayable()` unit tests covering every rejection and
  acceptance case, including the key-presence nuance
- 3 new `fetchAllCategories` integration tests for filter behaviour
  on the primary path, fallback path, and the search/videos.list delta
- 1 pre-existing sort test fixed (was using 3 IDs, silently fell
  through to the mostPopular fallback which doesn't sort — bumped to
  5 IDs so it actually exercises the sort code)
- Default `makeYtItem` fixture now includes a playable
  `status` + `contentDetails` block so existing tests stay green

### Other fixes bundled in this release
- `.gitignore` now excludes the repo-root `.env`, `.env.*`, and
  `backend/logs/` — previously only `backend/.env` was ignored, which
  meant a `git add .` could leak the real `YOUTUBE_API_KEY` sitting at
  the repo root.
- README env-config instructions now correctly point users to the
  repo-root `.env` (docker-compose reads that, not `backend/.env`).

---

# TrendPulse v3.0 — What Changed

## New Sources

| Source | Endpoint | Auth | Cache Key |
|--------|----------|------|-----------|
| Hacker News | `GET /api/hackernews` | None (Firebase public API) | `hn_trending` |
| GitHub Trending | `GET /api/github` | None (HTML scrape) | `github_trending` |
| Dev.to | `GET /api/devto` | None (public REST API) | `devto_trending` |

## YouTube Changes

- **Top 15 videos** per category (was 10)
- **Past 24 hours filter** — uses a two-pass strategy:
  1. `search.list` with `publishedAfter` (24h ago) + `order=viewCount` to find recent video IDs
  2. `videos.list` with those IDs to fetch full `snippet` + `statistics`
  - Falls back to `mostPopular` chart (no date filter) for categories with fewer than 5 results in the past 24h (niche categories with thin coverage)
- **Quota impact**: ~200 units/refresh vs ~100 previously. Still within 10,000 free daily units at 30-min intervals (~9,600/day)

## New Files

### Backend
```
backend/src/hackerNewsService.js    — HN Firebase API, top 15 stories
backend/src/githubTrendingService.js — HTML scrape of github.com/trending
backend/src/devtoService.js         — Dev.to public REST API, top 15 articles
```

### Frontend
```
frontend/src/components/HackerNews.js/.css
frontend/src/components/GitHubTrending.js/.css
frontend/src/components/DevTo.js/.css
frontend/src/components/shared.css   — shared section-header, skeleton, error styles
```

## Modified Files

| File | Change |
|------|--------|
| `backend/server.js` | Added `/api/hackernews`, `/api/github`, `/api/devto` routes; `/api/refresh` now flushes all 4 caches; `/api/health` reports all sources; `/api/cache-status` shows all TTLs; bumped to v3.0.0 |
| `backend/src/youtubeService.js` | Two-pass 24h fetch; `MAX_RESULTS` → 15; fallback to `mostPopular` when <5 results; longer timeout (15s) |
| `backend/.env.example` | Documents new sources (no keys needed) + quota note for YouTube |
| `frontend/src/App.js` | Wires all 4 `useTrending` hooks; parallel refresh; responsive 3-col grid |
| `frontend/src/App.css` | `max-width` 1000→1400px; `.dashboard-grid` 3-col responsive layout |
| `frontend/src/components/YouTube.js` | 15 skeletons; imports `shared.css`; new `section-header` markup; "Trending · Past 24h" badge |
| `frontend/src/components/YouTube.css` | Trimmed to YouTube-only rules; skeleton/section chrome moved to `shared.css` |
| `frontend/src/hooks/useTrending.js` | No logic changes; comment clarifying `manualRefresh` flushes all caches |

## API Reference (v3.0)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service health. 200 if YouTube key set, 503 if not. |
| GET | `/api/youtube` | Trending YT videos by category (past 24h, top 15). Cached 30 min. |
| GET | `/api/hackernews` | Top 15 HN stories. Cached 30 min. |
| GET | `/api/github` | Top 25 GitHub trending repos (daily). Cached 30 min. |
| GET | `/api/devto` | Top 15 Dev.to articles (past day). Cached 30 min. |
| GET | `/api/refresh` | Clears all 4 source caches. Rate limited: 5 req / 5 min. |
| GET | `/api/cache-status` | TTL info for all 4 cache keys. |

## Layout

```
┌─────────────────────────────────────────────────────────┐
│  Header (sticky) — logo · last updated · countdown      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  YouTube (full width)                                   │
│  [category tabs] [15 video rows]                        │
│                                                         │
├─────────────┬─────────────────┬───────────────────────┤
│  Hacker News│  GitHub Trending│  Dev.to               │
│  (top 15)   │  (today)        │  (top today)          │
└─────────────┴─────────────────┴───────────────────────┘
  3-col on ≥1100px · 2-col on ≥720px · 1-col on mobile
```
