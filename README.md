# 📡 TrendPulse — Trending Dashboard

A self-hosted, Dockerized dashboard that displays trending content from **YouTube, Hacker News, GitHub Trending, and Dev.to** — auto-refreshing every 30 minutes. Accessible from any device on your network.

**v3.4** — Split the dashboard into four separate pages (YouTube, Hacker News, GitHub Trending, Dev.to) with a clickable nav bar directly under the main header. Each page has its own time-frame + count dropdowns, all using the same 1/2/3/5/10/20-day × 5/10/15/20/25/50 options for a consistent UX across sources. Hash-based routing (`#/youtube`, `#/hackernews`, etc.) survives refresh and back-button navigation. See [v3.4 in CHANGES_v3.md](CHANGES_v3.md) for details.

**v3.3** — YouTube gained user-selectable time frame and count dropdowns above the category tabs. The backend fetches a widened super-set and the frontend filters client-side — zero quota impact per dropdown change.

**v3.0** — Added Hacker News, GitHub Trending, and Dev.to; YouTube upgraded to top 15 videos filtered to the past 24 hours.

---

## 📋 Prerequisites

- [Docker](https://docs.docker.com/engine/install/) (v20+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2+)
- [Node.js](https://nodejs.org/) v18+ *(only needed if running tests locally outside Docker)*

---

## 🔑 Step 1 — Get Your YouTube API Key

1. Go to https://console.cloud.google.com
2. Click **"Select a project"** → **"New Project"** → name it `trendpulse`
3. Click **"Enable APIs and Services"** → search **"YouTube Data API v3"** → **Enable**
4. Go to **"Credentials"** → **"Create Credentials"** → **"API Key"**
5. Copy the key — optionally restrict it to YouTube Data API for security

> **Free quota:** 10,000 units/day. The v3 24h fetch uses ~200 units per refresh (~9,600/day at 30-min intervals — within the free tier).

> **Hacker News, GitHub Trending, and Dev.to require no API keys.**

---

## ⚙️ Step 2 — Configure Environment

`docker-compose.yml` reads `YOUTUBE_API_KEY` via variable substitution from a
`.env` file in the **repo root** (same directory as `docker-compose.yml`).
This is the one docker-compose picks up automatically — do not put it in
`backend/.env`, that file is not read in the containerized flow.

```bash
cd trending-dashboard
cp backend/.env.example .env     # copies the template to the repo root
nano .env                         # paste your YouTube API key
```

Your repo-root `.env` should look like:
```env
YOUTUBE_API_KEY=AIzaSy...your_key_here...
PORT=3001
```

> ⚠️ **Never commit `.env` to Git.** The repo's `.gitignore` excludes `.env`,
> `.env.*`, and `backend/.env` — but always double-check `git status` before
> staging, and use `git add <specific files>` instead of `git add .` when in
> doubt.

> 💡 **Running tests or the backend directly on the host** (outside Docker)?
> Backend code still loads `backend/.env` via `dotenv` for that flow. The two
> files can coexist — docker-compose uses the root `.env`, host `node` uses
> `backend/.env`. The `YOUTUBE_API_KEY` value should be identical in both.

---

## 🚀 Step 3 — Launch with Docker

```bash
docker compose up -d --build
```

Check that both containers are running:
```bash
docker compose ps
```

---

## 🌐 Step 4 — Access the Dashboard

**From your server:**
```
http://localhost:8080
```

**From any device on your local network:**
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
# → e.g. inet 192.168.1.100
```
Then open `http://192.168.1.100:8080` on any phone, tablet, or computer.

---

## 📊 Dashboard Layout

As of v3.4, each source has its own dedicated page. The dashboard opens on
the YouTube page by default; click a nav pill to switch pages. Each page has
its own Time frame + Show dropdowns that work independently — switching pages
preserves your dropdown selections per page.

```
┌────────────────────────────────────────────────────────────┐
│  Header — logo · last updated · countdown · Refresh Now    │
├────────────────────────────────────────────────────────────┤
│  [▶️ YouTube] [🔶 Hacker News] [🐙 GitHub] [📝 Dev.to]       │
│   ← clickable nav pills — active page highlighted           │
├────────────────────────────────────────────────────────────┤
│  (active page — one of the four)                            │
│                                                            │
│  Section header (icon · name · badge · source link ↗)       │
│  [Time frame ▾]  [Show ▾]    ← shared filter UX             │
│  [Category tabs — YouTube only]                             │
│                                                            │
│  Filtered, ranked list of videos / stories / repos /        │
│  articles. Defaults: Past 1 day × 15 items.                 │
└────────────────────────────────────────────────────────────┘
```

**Navigation.** The URL hash reflects the active page — `#/youtube`,
`#/hackernews`, `#/github`, `#/devto`. Refreshing the page or using the
browser's back/forward button restores the correct page.

---

## 🧪 Running Tests

All tests use mocked network calls — no real API key needed.

**Run all tests locally:**
```bash
./scripts/run-tests.sh

# With coverage reports:
./scripts/run-tests.sh --coverage
```

**Backend only:**
```bash
cd backend && npm install && npm test
```

**Frontend only:**
```bash
cd frontend && npm install && npm test
```

**Inside Docker (no Node.js required on host):**
```bash
docker compose --profile test run --rm test
```

### Test Coverage — 308 tests across 13 files (305 passing, 3 pre-existing failures)

**Backend — 151 tests (149 passing, 2 pre-existing failures):**

| File | Tests |
|------|------:|
| `backend/tests/api.test.js` | 32 |
| `backend/tests/youtubeService.test.js` | 54 |
| `backend/tests/hackerNewsService.test.js` | 17 |
| `backend/tests/githubTrendingService.test.js` | 17 |
| `backend/tests/devtoService.test.js` | 20 |
| `backend/tests/cacheManager.test.js` | 11 |

**Frontend — 157 tests (156 passing, 1 pre-existing failure):**

| File | Tests |
|------|------:|
| `frontend/src/components/__tests__/YouTube.test.js` | 27 |
| `frontend/src/components/__tests__/HackerNews.test.js` | 25 |
| `frontend/src/components/__tests__/GitHubTrending.test.js` | 28 |
| `frontend/src/components/__tests__/DevTo.test.js` | 29 |
| `frontend/src/components/__tests__/ErrorBoundary.test.js` | 5 |
| `frontend/src/hooks/__tests__/useTrending.test.js` | 10 |
| `frontend/src/utils/__tests__/formatters.test.js` | 33 |

The 3 pre-existing failures (2 backend in `api.test.js`, 1 frontend in
`ErrorBoundary.test.js`) predate any of this work and are documented in
the agent's project memory — they are not regressions from v3.x.

---

## ▶️ YouTube Filters (time frame + count)

Above the category tabs, two dropdowns let you pick:

| Dropdown | Options | Default |
|---|---|---|
| **Time frame** | 1, 2, 3, 5, 10, or 20 days | 1 day |
| **Show** | 5, 10, 15, 20, 25, or 50 videos | 15 |

Both filters run **client-side** against a cached super-set the backend
fetched once (up to 50 videos per category across the last 21 days).
Changing either dropdown is instant — no API call, no quota cost, no
loading state. The "Trending · Past N days" badge updates to reflect
your time-frame pick.

If the selected time frame is narrower than what's available and a
category has zero videos in that window, the tab shows "No videos
found for this category." (Option A.) Widen the dropdown to see more.

### How it fits with the backend

- `MAX_RESULTS = 50` in `backend/src/youtubeService.js` — the widest
  single-request set `search.list` and `videos.list` allow.
- `MAX_AGE_MS = 21 days` — the backend's outer recency guardrail.
  Anything older is dropped at the backend because no dropdown pick
  could reach it anyway. The extra day over 20 absorbs YouTube's
  fuzzy `publishedAfter` enforcement and the 30-min cache TTL.
- `TIME_FRAME_OPTIONS` and `COUNT_OPTIONS` in
  `frontend/src/components/YouTube.js` — edit these arrays to
  change the dropdown choices. Anything you add must be ≤ the
  backend constants above, or the pick will return empty.

### Quota note

Widening the fetch to 21 days + 50 results does **not** change the
YouTube API quota cost. `search.list` is 100 units regardless of
`publishedAfter` width or `maxResults` (capped at 50). `videos.list`
is 1 unit per call regardless of how many IDs are in the `id=` list.
So a refresh is still ~101 units × 11 categories = ~1,111 units.

---

## 🔶🐙📝 Hacker News / GitHub / Dev.to Filters

v3.4 extends the YouTube filter UX to every source page. Each page has the
same two dropdowns — **Time frame** (1/2/3/5/10/20 days) and **Show**
(5/10/15/20/25/50) — but the underlying filter strategy differs per source:

| Source | Time-frame filter | Count | Super-set size |
|---|---|---|---|
| **YouTube** | client-side over `video.publishedAt` | client-side slice | up to 50/category, 21-day window |
| **Hacker News** | client-side over `story.time` | client-side slice | top 100 stories (`TOP_N`) |
| **GitHub Trending** | **picks between pre-fetched daily / weekly / monthly buckets** — GitHub's scrape has no per-repo timestamps, so `1d → daily`, `2d–3d → weekly`, `5d–20d → monthly` | client-side slice | all 3 buckets (~25 repos each) |
| **Dev.to** | client-side over `article.publishedAt` | client-side slice | 50 articles over 30-day window (`top=30&per_page=50`) |

Every dropdown change is instant — zero API calls. The backend fetches the
widest possible super-set once per 30-minute cache cycle, and the frontend
slices/filters that super-set based on the dropdown state.

**GitHub's "lossy" mapping.** Because github.com/trending only exposes three
time buckets (daily, weekly, monthly), picks of 5, 10, and 20 days all show
the same monthly bucket. The badge makes this explicit: it reads
`Trending · Monthly · Past N days` so the user can see which GitHub range
they're actually looking at. This was chosen over hiding 10- and 20-day
from the GitHub dropdown to keep the dropdown options identical across
every source — consistency wins.

**Backend caps** (edit these in tandem with `frontend/src/utils/filterOptions.js`):

- `backend/src/hackerNewsService.js` — `TOP_N = 100`
- `backend/src/devtoService.js` — `TOP_DAYS = 30`, `PER_PAGE = 50`
- `backend/src/githubTrendingService.js` — fetches all 3 `?since=` variants via `fetchAllRanges()`
- `backend/src/youtubeService.js` — `MAX_AGE_MS = 21 days`, `MAX_RESULTS = 50`

---

## ▶️ YouTube Playability Filter

Not every "public" video is actually playable. The YouTube Data API
occasionally reports videos as `privacyStatus: public` and
`uploadStatus: processed` even though the watch page itself returns
`"Video unavailable"` — commonly on rights-gated sports broadcasts (ESPN,
NFL, PGA). To keep broken links out of the dashboard, `youtubeService.js`
runs an `isPlayable()` filter over every item returned by `videos.list`
before normalising and sorting.

Videos are dropped when **any** of the following is true:

| Rule | Signal |
|------|--------|
| Not processed | `status.uploadStatus !== "processed"` (deleted/failed/rejected) |
| Not public | `status.privacyStatus !== "public"` (private/unlisted) |
| Region-blocked | `contentDetails.regionRestriction.blocked` contains `US` |
| Region allow-list excludes US | `contentDetails.regionRestriction.allowed` set and excludes `US` |
| Rights-gated / broken | `statistics.viewCount` **key is missing entirely** (empirically correlates with `playabilityStatus: ERROR` on the watch page) |
| Outside the outer recency guardrail | `snippet.publishedAt` older than **21 days** (`MAX_AGE_MS`) |

### Recency guardrail (backend side)

`isRecent(item, nowMs)` runs locally as a second-stage filter on every
video returned by both the primary and fallback paths. Its job is to
make sure the dashboard never receives videos older than the widest
possible user selection (20 days, plus a 1-day slack = 21 days total).

This matters because:

1. **`search.list?publishedAfter` is fuzzy** — YouTube sometimes returns
   videos an hour or two past the boundary we asked for.
2. **The `mostPopular` fallback chart has no date filter at all.** When
   `search.list` returns fewer than 5 results for a niche category, we
   fall back to the most-popular chart — which would otherwise leak
   month-old videos into the response.

The user's dropdown pick (1, 2, 3, 5, 10, or 20 days) is applied
client-side on top of this guardrail. The backend's job is only to say
"no content older than 21 days ever reaches the frontend."

Videos with missing or unparseable `publishedAt` are also dropped by
`isRecent`.

The filter requires `status` and `contentDetails` to be in the
`videos.list` `part` parameter — they are bundled into the
`VIDEO_PARTS` constant in `backend/src/youtubeService.js`. If you're
editing that file, **do not trim the parts list** without also updating
`isPlayable()`, or the corresponding filter rule silently becomes a
no-op.

The check uses **key presence, not value**, for `viewCount` — a legit
fresh upload with zero views still has the key present and passes
through.

Dropped counts are logged at `info` level with the category name, so
you can grep `backend/logs/combined.log` for `dropped ... unplayable`
to see the filter's activity after a refresh.

---

## 🔄 Auto-Refresh & Cache

| Behavior | Detail |
|----------|--------|
| Auto-refresh interval | Every 30 minutes |
| Fresh cache TTL | 30 minutes |
| Stale cache TTL | 60 minutes (fallback if source is down) |
| Manual refresh | "Refresh Now" button — flushes all 4 source caches |
| Rate limit | Max 5 manual refreshes per 5-minute window |

---

## 🔒 Security & Reliability

| Feature | Implementation |
|---------|----------------|
| Security headers | `helmet` |
| Rate limiting | `express-rate-limit` |
| Retry with backoff | `axios-retry` — 3 attempts, exponential delay |
| Stale cache fallback | Serves last-known data if a source is temporarily down |
| Error boundaries | Each panel catches its own React errors independently |
| Structured logging | `winston` — logs to console + rotating files in `backend/logs/` |

---

## 🛠️ Management Commands

```bash
# Lifecycle
docker compose up -d             # Start
docker compose down              # Stop
docker compose up -d --build     # Rebuild after code changes
docker compose restart backend   # Restart backend only

# Logs
docker compose logs -f           # Stream all logs
docker compose logs -f backend   # Backend only
cat backend/logs/combined.log    # View persisted log file

# API utilities
curl http://localhost:8080/api/health | jq
curl http://localhost:8080/api/cache-status | jq
curl http://localhost:8080/api/refresh
```

---

## 🐛 Troubleshooting

**"YouTube API key not configured"**
→ Check the repo-root `.env` (same directory as `docker-compose.yml`) has
`YOUTUBE_API_KEY=` set to your real key, then:
```bash
docker compose up -d --build backend
```
*(Use `--build` — a plain `restart` only reloads the container, not your
code changes, and won't re-read env substitutions.)*

**Dashboard shows stale data**
→ A source was temporarily unavailable; cached data is being served.
Click **"Refresh Now"** once the source recovers.

**GitHub Trending shows no repos**
→ GitHub occasionally changes its HTML structure. Check `backend/src/githubTrendingService.js` — the regex parser may need a small update.

**YouTube quota exceeded (403)**
→ You've used more than 10,000 API units today. The stale cache will serve your last-fetched data. Quota resets at midnight Pacific Time.

**Can't access from other devices on the network**
```bash
# Ubuntu/Debian:
sudo ufw allow 8080/tcp && sudo ufw reload
```

---

## 📜 License

MIT — use, modify, and self-host freely.
