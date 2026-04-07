# 📡 TrendPulse — YouTube Trending Dashboard

A self-hosted, Dockerized dashboard that displays trending YouTube videos across categories —
auto-refreshing every 30 minutes. Accessible from any device on your network.

**v2.0** — hardened with retry logic, stale-cache fallback, rate limiting, structured logging,
error boundaries, and a full test suite.

---

## 📋 Prerequisites

Install these on your home server before starting:

- [Docker](https://docs.docker.com/engine/install/) (v20+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2+)
- [Node.js](https://nodejs.org/) v18+ *(only needed if running tests locally outside Docker)*

Verify with:
```bash
docker --version        # Docker version 20.x or higher
docker compose version  # Docker Compose version v2.x or higher
node --version          # v18.x or higher (for local testing only)
```

---

## 🔑 Step 1 — Get Your YouTube API Key

1. Go to https://console.cloud.google.com
2. Click **"Select a project"** → **"New Project"** → name it `trendpulse`
3. Click **"Enable APIs and Services"** → search **"YouTube Data API v3"** → **Enable**
4. Go to **"Credentials"** → **"Create Credentials"** → **"API Key"**
5. Copy the key — optionally restrict it to YouTube Data API for security

> **Free quota:** 10,000 units/day. The dashboard uses ~100 units per full refresh
> (~4,800/day at 30-min intervals — well within the free tier).

---

## ⚙️ Step 2 — Configure Environment

```bash
# Copy the project to your server, then:
cd trending-dashboard

# Create your .env file from the template
cp backend/.env.example backend/.env

# Edit and paste your key
nano backend/.env
```

Your `backend/.env` should look like this:
```env
YOUTUBE_API_KEY=AIzaSy...your_key_here...
PORT=3001
```

> ⚠️ **Never commit `.env` to Git.** It is already listed in `.gitignore`.

---

## 🚀 Step 3 — Launch with Docker

```bash
# From the trending-dashboard/ directory:
docker compose up -d --build
```

Docker will:
1. Build the Node.js backend image
2. Build and bundle the React frontend with nginx
3. Start both containers and connect them on an internal network
4. Mount `backend/logs/` on your host so log files persist

Check that everything is running:
```bash
docker compose ps
```

You should see both `trendpulse-backend` and `trendpulse-frontend` with status **healthy/running**.

---

## 🌐 Step 4 — Access the Dashboard

### From your home server
```
http://localhost:8080
```

### From any device on your local network
First find your server's local IP:
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
# Example output: inet 192.168.1.100/24
```

Then open on any phone, tablet, or computer on your network:
```
http://192.168.1.100:8080
```

### From anywhere (optional — remote access)

**Option A — Tailscale (recommended, easiest)**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```
Access via your Tailscale IP from any device with Tailscale installed.

**Option B — Cloudflare Tunnel (no port forwarding needed)**
```
https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
```

**Option C — Port forwarding**
Forward port `8080` on your router to your server's local IP.
⚠️ Only do this with a firewall in place.

---

## 🧪 Running the Test Suite

TrendPulse ships with a full test suite. All tests use mocked network calls —
no real API key is needed to run them.

### Backend Tests (Jest + Supertest + Nock)

**Run locally:**
```bash
cd backend
npm install
npm test
```

**Run with coverage report:**
```bash
cd backend
npm run test:coverage
```
Open `backend/coverage/lcov-report/index.html` for a line-by-line view.

**Run inside Docker (no Node.js required on host):**
```bash
docker compose --profile test run --rm test
```

### Frontend Tests (React Testing Library)

**Run locally:**
```bash
cd frontend
npm install
npm test
```

**Run with coverage:**
```bash
cd frontend
npm run test:coverage
```

---

### What's Tested

#### Backend — 3 test files, 40+ test cases

| File | What's covered |
|---|---|
| `tests/api.test.js` | Every route: 200 success, cache hits, 503 (missing key), 502 (API down/quota), 404 for unknown and removed routes, security headers |
| `tests/youtubeService.test.js` | `normalizeVideo`, `validateApiKey`, category fetching, 403 quota errors, 500 server errors, empty responses |
| `tests/cacheManager.test.js` | get/set, TTL values, stale fallback, `flush` vs `flushAll`, key listing |

#### Frontend — 4 test files, 50+ test cases

| File | What's covered |
|---|---|
| `src/components/__tests__/YouTube.test.js` | Loading skeletons, error banners, video rendering, rank numbers, category switching, aria roles, empty state |
| `src/components/__tests__/ErrorBoundary.test.js` | Child renders normally, fallback UI on crash, error message display, Try Again reset |
| `src/hooks/__tests__/useTrending.test.js` | Initial load, error states, auto-refresh at 30 min, manual refresh, network failure |
| `src/utils/__tests__/formatters.test.js` | `formatNum`, `formatScore`, `timeAgo`, `truncate`, `isValidThumbnail`, `formatCountdown` — all edge cases |

---

### Expected Test Output

```
Backend:
  PASS tests/cacheManager.test.js
  PASS tests/youtubeService.test.js
  PASS tests/api.test.js

  Test Suites: 3 passed, 3 total
  Tests:       40+ passed
  Coverage:    Statements >70%, Branches >60%

Frontend:
  PASS src/utils/__tests__/formatters.test.js
  PASS src/components/__tests__/ErrorBoundary.test.js
  PASS src/components/__tests__/YouTube.test.js
  PASS src/hooks/__tests__/useTrending.test.js

  Test Suites: 4 passed, 4 total
  Tests:       50+ passed
```

---

## 🛠️ Management Commands

```bash
# ── Lifecycle ──────────────────────────────────────────────
docker compose up -d                  # Start
docker compose down                   # Stop
docker compose up -d --build          # Rebuild after code changes
docker compose restart backend        # Restart backend (e.g. after editing .env)

# ── Logs ───────────────────────────────────────────────────
docker compose logs -f                # Stream all logs
docker compose logs -f backend        # Stream backend logs only
cat backend/logs/combined.log         # View persisted log file
cat backend/logs/error.log            # View error log file

# ── API utilities ───────────────────────────────────────────
curl http://localhost:8080/api/health | jq         # Health + config status
curl http://localhost:8080/api/cache-status | jq   # Cache TTL info
curl http://localhost:8080/api/refresh             # Force data refresh

# ── Tests ───────────────────────────────────────────────────
docker compose --profile test run --rm test        # Backend tests in Docker
cd backend   && npm run test:coverage              # Backend tests + coverage
cd frontend  && npm test                           # Frontend tests
```

---

## 🔄 Auto-Refresh & Cache Behavior

| Behavior | Detail |
|---|---|
| Auto-refresh interval | Every 30 minutes |
| Countdown timer | Live display in the dashboard header |
| Fresh cache TTL | 30 minutes — serves cached data within this window |
| Stale cache TTL | 60 minutes — if YouTube is temporarily down, serves the last known data |
| Manual refresh | "Refresh Now" button clears cache and triggers an immediate re-fetch |
| Rate limit on refresh | Max 5 manual refreshes per 5-minute window per IP |

---

## 🔒 Security & Reliability Features

| Feature | Implementation |
|---|---|
| Security headers | `helmet` (X-Frame-Options, X-Content-Type-Options, etc.) |
| Rate limiting | `express-rate-limit` — 100 req/15 min general, 5 refreshes/5 min |
| Retry with backoff | `axios-retry` — 3 attempts with exponential delay on network/5xx errors |
| Stale cache fallback | Serves last-known data if YouTube API is temporarily unavailable |
| Error boundaries | Dashboard panel catches its own React errors independently |
| Structured logging | `winston` — logs to console + rotating files in `backend/logs/` |
| Input validation | API key validated before any network call is made |
| Graceful degradation | A single failed category returns `[]` — other categories still load |

---

## 📁 Project Structure

```
trending-dashboard/
├── docker-compose.yml              # Production: backend + frontend
├── docker-compose.test.yml         # Test runner compose file
├── .gitignore
├── README.md
│
├── scripts/
│   └── run-tests.sh                # Convenience script: runs all tests
│
├── backend/
│   ├── server.js                   # Express app (routes, middleware, error handler)
│   ├── package.json
│   ├── Dockerfile                  # Production image
│   ├── Dockerfile.test             # Test runner image
│   ├── .env                        # YOUR KEY GOES HERE (never commit)
│   ├── .env.example                # Template
│   ├── logs/                       # Persisted log files (auto-created)
│   │   ├── combined.log
│   │   └── error.log
│   ├── src/
│   │   ├── logger.js               # Winston structured logger
│   │   ├── httpClient.js           # Axios + retry logic
│   │   ├── cacheManager.js         # Two-tier cache (fresh + stale fallback)
│   │   └── youtubeService.js       # YouTube API logic (isolated, testable)
│   └── tests/
│       ├── setup.js                # Jest globalSetup — sets test env vars
│       ├── api.test.js             # Integration tests for all routes
│       ├── youtubeService.test.js  # YouTube service unit tests
│       └── cacheManager.test.js    # Cache unit tests
│
└── frontend/
    ├── Dockerfile                  # Multi-stage: build → nginx
    ├── Dockerfile.test             # Frontend test runner image
    ├── nginx.conf                  # Reverse proxy /api/* → backend
    ├── package.json
    └── src/
        ├── App.js / App.css        # Root layout + error boundary wiring
        ├── index.js / index.css    # Entry point + global dark theme CSS
        ├── utils/
        │   ├── formatters.js       # Pure formatting helpers (testable)
        │   └── __tests__/
        │       └── formatters.test.js
        ├── hooks/
        │   ├── useTrending.js      # Data fetching + 30-min auto-refresh
        │   └── __tests__/
        │       └── useTrending.test.js
        └── components/
            ├── ErrorBoundary.js/.css   # React error boundary with retry UI
            ├── Header.js/.css          # Sticky header with countdown timer
            ├── YouTube.js/.css         # Trending video grid + category tabs
            └── __tests__/
                ├── ErrorBoundary.test.js
                └── YouTube.test.js
```

---

## 🐛 Troubleshooting

**"YouTube API key not configured"**
→ Check `backend/.env` has `YOUTUBE_API_KEY=` set to your real key (not the placeholder), then:
```bash
docker compose restart backend
```

**Dashboard shows stale data or "stale-cache" badge**
→ YouTube was temporarily unavailable; the dashboard served its last known data.
Click **"Refresh Now"** once the API recovers.

**Can't access from other devices on the network**
```bash
# Ubuntu/Debian (ufw):
sudo ufw allow 8080/tcp && sudo ufw reload
```

**Container fails to start or healthcheck keeps failing**
```bash
docker compose logs backend
docker compose logs frontend
cat backend/.env   # confirm key is present and not the placeholder value
```

**YouTube quota exceeded (403 error)**
→ You've used more than 10,000 API units today. Quota resets at midnight Pacific Time.
The stale cache will serve your last-fetched data in the meantime.

**Tests fail with "Cannot find module" errors**
```bash
cd backend   && npm install
cd ../frontend && npm install
```

---

## ➕ Adding More Platforms Later

Future platforms follow the same pattern:

1. Add a service file in `backend/src/` (e.g. `hackerNewsService.js`)
2. Add a route in `backend/server.js`
3. Add a test file in `backend/tests/`
4. Create a component in `frontend/src/components/`
5. Wire it into `App.js` with an `<ErrorBoundary>` wrapper

**Platforms with accessible free APIs:**

| Platform | API | Notes |
|---|---|---|
| Hacker News | https://hacker-news.firebaseio.com | Free, no key needed |
| GitHub Trending | https://api.github.com | Free, 60 req/hr unauthenticated |
| Dev.to | https://dev.to/api | Free, no key needed |
| Twitter/X | https://developer.twitter.com | Paid — $100+/month for Basic tier |

---

## 📜 License

MIT — use, modify, and self-host freely.
