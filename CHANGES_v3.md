# TrendPulse — Changelog

## v3.4 — Per-source pages with unified filters + nav (2026-04-11)

### Summary
The dashboard was a single-page grid of all four sources. v3.4 splits it
into four dedicated pages (YouTube, Hacker News, GitHub Trending, Dev.to)
connected by a clickable nav bar directly under the main header. Every
page now has the same two-dropdown filter UX that YouTube gained in v3.3,
even though the underlying filter mechanics differ per source.

### User-visible changes
- **Nav bar** (`components/Nav.js`) with four pills styled to echo the
  section-title + section-badge look from each source header. Clicking a
  pill switches pages instantly. The active pill is highlighted.
- **Hash-based routing** — `#/youtube`, `#/hackernews`, `#/github`,
  `#/devto`. Refresh + back/forward work. Unknown hashes default to
  YouTube.
- **Every source page gains Time frame + Show dropdowns** with the same
  options as YouTube's v3.3 dropdowns (1/2/3/5/10/20 days ×
  5/10/15/20/25/50 items). Page state is independent per page —
  switching pages preserves each page's dropdown selections within the
  same session.
- **Per-page badges** now read `Top Stories · Past N days`,
  `Trending · Daily · Past 1 day`, `Top · Past 5 days`, etc. — honest
  about the current filter state.
- **Re-numbered ranks** — the rank column on each card (#1, #2, …)
  reflects the filtered display position, not the original backend rank.
  Same behavior YouTube has had since v3.3; HN / GitHub / Dev.to pick it
  up in v3.4.

### Architecture
Same "fetch wide, filter client-side" pattern as v3.3, extended per
source:

| Source | Backend super-set | Filter strategy |
|---|---|---|
| YouTube | 21-day window × up to 50/category (unchanged from v3.3) | client-side on `video.publishedAt` |
| HackerNews | `TOP_N` raised 15 → **100** stories | client-side on `story.time` |
| GitHub | New `fetchAllRanges()` — pre-fetches **daily / weekly / monthly** in parallel via `Promise.allSettled` | time-frame dropdown maps to one of three buckets; no per-repo date filter is possible |
| Dev.to | `top=1` → `top=30`, `per_page=15` → `per_page=50` | client-side on `article.publishedAt` |

**Why GitHub is the odd one.** github.com/trending's HTML scrape exposes
no per-repo publish timestamps (only stars-today). So we pre-fetch all
three `?since=` variants and let the time-frame dropdown pick a bucket
(`1d → daily`, `2d–3d → weekly`, `5d–20d → monthly`). The badge shows
the bucket name so the user can see exactly which GitHub range they're
on — `Trending · Weekly · Past 3 days`.

**Why `Promise.allSettled` for GitHub.** If one range fails (rate limit,
network blip), the other two still succeed. The failing bucket returns
an empty array rather than 500-ing the whole endpoint. This is a real
behaviour change from v3.3, where a single HTTP failure took down the
whole /api/github response.

### Shared frontend utilities
- **New** `frontend/src/utils/filterOptions.js` — the single source of
  truth for `TIME_FRAME_OPTIONS`, `COUNT_OPTIONS`,
  `DEFAULT_TIME_FRAME_DAYS`, `DEFAULT_COUNT`,
  `applyTimeAndCountFilter(items, days, count, dateField)`, and
  `timeFrameLabel(days)`. All four source components import from here,
  so widening the dropdowns means editing one file.
- **New** `.filter-row` / `.filter-group` / `.filter-label` /
  `.filter-select` CSS in `shared.css`, used by every source. Each
  source can override the hover/focus accent colour locally (YouTube
  keeps its red accent).
- **New** `components/Nav.js` + `Nav.css` — hash-aware routing pills.
  `PAGES` exported from `Nav.js` is consumed by `App.js` for the active
  page dispatch.

### App.js routing
Rewritten from the v3.x three-column grid to a single-page renderer:

- `useState` for `activePage` initialised from `window.location.hash`
- `useEffect` listener on `hashchange` → keeps state in sync with
  back/forward nav
- `handleNavSelect(id)` writes `#/<id>` and lets the listener update
  state (single source of truth)
- All four `useTrending` hooks still mount on load → page switches are
  instant because data is already cached in hook state
- Dead `.dashboard-grid` CSS removed; `dashboard-main` gap tightened
  for the single-column layout

### Tests
Backend: 148 → **151** tests (149 passing, 2 pre-existing failures).
The new ones are 3 `fetchAllRanges` tests in `githubTrendingService.test.js`
covering success / partial failure via `Promise.allSettled` / total
failure. The `api.test.js` GitHub mocks were rewritten to cover the new
`{ daily, weekly, monthly }` bucket shape (one test replaced in place,
net zero count change).

Frontend — four source component suites: 83 → **109** tests across
YouTube / HackerNews / GitHubTrending / DevTo. Full frontend count is
131 → **157** (the other three suites — ErrorBoundary, useTrending,
formatters — were unchanged). 156 passing, 1 pre-existing failure.

- `HackerNews.test.js`: 16 → 25 (added `filter dropdowns` describe block,
  updated badge + rank + empty-state assertions)
- `GitHubTrending.test.js`: 19 → 28 (rewrote data fixtures for the new
  `{ daily, weekly, monthly }` shape, added `filter dropdowns` block
  covering bucket switching at every dropdown value)
- `DevTo.test.js`: 21 → 29 (added `filter dropdowns` block, updated badge
  + rank + empty-state assertions)
- `YouTube.test.js`: 27 unchanged (already v3.3 behavior; verified
  the shared-constants refactor didn't break anything)

One pre-existing broken frontend test remains:
`ErrorBoundary — Try Again button resets the error state`. It was broken
on clean `main` before this commit and is unrelated to v3.4 — flagged
for a future cleanup pass.

### Live verification after deploy
- Backend: HN returns 99 stories, GitHub returns
  `{ daily: 13, weekly: 12, monthly: 18 }`, Dev.to returns 50 articles
- Frontend bundle contains `nav-pill`, `filter-row`, `filter-select`,
  `Hacker News`, `GitHub Trending`, and all six `Past N day(s)` labels
- docker-compose rebuild healthy, frontend bundle hash bumped

### Follow-up ideas (not done)
- `ErrorBoundary` pre-existing test fix — surfaced again this cycle
- Deep-linking into category tabs on YouTube (currently only page-level
  routing is in the hash — category and dropdown state are per-session)
- Persist dropdown selections in localStorage so they survive refresh

---

## v3.3 — User-selectable YouTube time frame + count (2026-04-11)

### Summary
Two new dropdowns above the category tabs let the user pick:

- **Time frame** — 1 / 2 / 3 / 5 / 10 / 20 days (default 1)
- **Show** — 5 / 10 / 15 / 20 / 25 / 50 videos (default 15)

Both filters run client-side against a cached super-set fetched by the
backend. Changing either dropdown is instant — zero YouTube API calls,
zero quota cost per change, no loading state.

### Architecture

**Hybrid filter** — backend fetches widest set once, frontend slices:

- Backend: `MAX_RESULTS` raised from 15 → **50** (YouTube's single-call
  cap for both `search.list` and `videos.list`).
- Backend: `MAX_AGE_MS` raised from 26h → **21 days** (outer guardrail,
  = widest dropdown + 1 day of slack for `publishedAfter` fuzziness).
- Backend: renamed `get24HoursAgo()` → `getPublishedAfterCutoff()` and
  wired it to `MAX_AGE_MS` so the search and the local recency filter
  share one source of truth.
- Frontend: new `TIME_FRAME_OPTIONS` and `COUNT_OPTIONS` arrays in
  `YouTube.js`. Two `<select>` elements in a new `.yt-filters` row
  between `.section-header` and `.category-tabs`. Client-side filter
  uses `useMemo` to recompute on dropdown change — (1) drop items
  where `publishedAt` is null/unparseable/older than `days * 24h`,
  (2) slice to `count`.
- Frontend: badge updates dynamically (`"Trending · Past 1 day"`,
  `"Trending · Past 10 days"`, etc.) based on the time-frame pick.

### Quota impact — none
`search.list` is 100 units regardless of `publishedAfter` width or
`maxResults` (capped at 50). `videos.list` is 1 unit per call regardless
of how many IDs you pass. So a refresh is still ~101 units × 11
categories = ~1,111 units. The dropdowns themselves trigger **zero**
API calls because they operate entirely on the cached super-set.

### Tests
Backend `youtubeService.test.js`: 52 → **54** (boundary tests updated
for 21-day window, `MAX_RESULTS` test updated for 50, new "accepts 10
days" and "accepts 20 days" cases for isRecent).

Frontend `YouTube.test.js`: 17 → **27**. New `YouTube — filter
dropdowns` describe block (10 tests):

- default 1-day filter shows only 24h-recent videos
- 2-day dropdown includes the 30h video
- 3-day dropdown includes the 30h + 50h videos
- 20-day dropdown caps at the count limit
- count dropdown trims from 20 to 5
- count=50 shows all eligible (<50) videos
- dropdowns disabled during loading
- videos with missing `publishedAt` are dropped
- empty state when nothing matches the selected window
- badge updates when time-frame changes

Two pre-existing broken tests also fixed as drive-by cleanup — both
relied on `getByText("Test Trending Video")` which silently failed when
`makeData()` had two videos with that same default title, and a
hardcoded `watch?v=vid1` URL in `makeVideo()` that didn't derive from
the overridden `id`. `makeVideo` now computes `url` and `thumbnail`
from `id`, and `makeData` gives the second All-category video a
distinct title.

### Live verification after deploy
Every category now ships 30–50 videos spanning the full 21 days.
Gaming: 50 videos, 41 within 24h. Music: 30 videos, 0 within 24h
(empty if user picks 1 day, full if they pick 10+). Science & Tech
oldest: 18.6 days (inside the 21-day guardrail).

### How to tune
Edit `TIME_FRAME_OPTIONS` or `COUNT_OPTIONS` in
`frontend/src/components/YouTube.js`. Any added option must satisfy:

- `option.days ≤ 21` (backend's `MAX_AGE_MS` in days)
- `option.count ≤ 50` (backend's `MAX_RESULTS`)

If you need to exceed either, raise `MAX_AGE_MS` / `MAX_RESULTS` in
`backend/src/youtubeService.js` first. Both constants are exported so
tests can assert on them.

---

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
