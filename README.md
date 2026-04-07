# 📡 TrendPulse — Trending Dashboard

A self-hosted, Dockerized dashboard that displays trending content from **YouTube, Hacker News, GitHub Trending, and Dev.to** — auto-refreshing every 30 minutes. Accessible from any device on your network.

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

```bash
cd trending-dashboard
cp backend/.env.example backend/.env
nano backend/.env   # paste your YouTube API key
```

Your `backend/.env` should look like:
```env
YOUTUBE_API_KEY=AIzaSy...your_key_here...
PORT=3001
```

> ⚠️ **Never commit `.env` to Git.** It is already in `.gitignore`.

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

```
┌────────────────────────────────────────────────────────────┐
│  Header — logo · last updated · countdown · Refresh Now    │
├────────────────────────────────────────────────────────────┤
│  YouTube (full width)                                      │
│  [All] [Music] [Gaming] [Entertainment] … category tabs    │
│  Top 15 trending videos · past 24 hours                    │
├──────────────────┬─────────────────┬───────────────────────┤
│  Hacker News     │  GitHub Trending│  Dev.to               │
│  Top 15 stories  │  Today's repos  │  Top today            │
└──────────────────┴─────────────────┴───────────────────────┘
  3 columns ≥1100px · 2 columns ≥720px · 1 column on mobile
```

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

### Test Coverage — 179 tests across 9 files

| File | Tests |
|------|------:|
| `backend/tests/api.test.js` | 32 |
| `backend/tests/youtubeService.test.js` | 23 |
| `backend/tests/hackerNewsService.test.js` | 17 |
| `backend/tests/githubTrendingService.test.js` | 14 |
| `backend/tests/devtoService.test.js` | 20 |
| `backend/tests/cacheManager.test.js` | 8 |
| `frontend/src/components/__tests__/YouTube.test.js` | 17 |
| `frontend/src/components/__tests__/HackerNews.test.js` | 16 |
| `frontend/src/components/__tests__/GitHubTrending.test.js` | 19 |
| `frontend/src/components/__tests__/DevTo.test.js` | 21 |
| `frontend/src/components/__tests__/ErrorBoundary.test.js` | 5 |
| `frontend/src/hooks/__tests__/useTrending.test.js` | 11 |
| `frontend/src/utils/__tests__/formatters.test.js` | 20 |

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
→ Check `backend/.env` has `YOUTUBE_API_KEY=` set to your real key, then:
```bash
docker compose restart backend
```

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
