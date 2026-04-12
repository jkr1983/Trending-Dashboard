# TrendPulse — Changelog

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
