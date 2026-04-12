# TrendPulse — Complete Project Reference

YouTube Trending Dashboard v3.4 (reference doc)
Self-hosted · Dockerized · Auto-refreshing · Full test suite

> ⚠️ **Doc drift warning.** This file contains embedded code blocks that
> are **historical snapshots**, not a live source mirror. Many predate
> v3 (four-source dashboard), v3.1 (playability filter), v3.2 (recency
> filter), v3.3 (user-selectable dropdowns), and v3.4 (per-source pages
> + nav bar + widened HN/GitHub/Dev.to fetches + shared filter utils).
> Treat the files under `backend/src/`, `backend/tests/`, `frontend/src/`,
> and `docker-compose.yml` as the canonical source of truth and this
> document as a high-level map.
>
> **v3.4 files NOT in this reference** (read the live files instead):
>
> - `backend/src/hackerNewsService.js` — `TOP_N = 100`
> - `backend/src/devtoService.js` — `TOP_DAYS = 30`, `PER_PAGE = 50`
> - `backend/src/githubTrendingService.js` — `fetchAllRanges()` returns `{ daily, weekly, monthly }`
> - `backend/server.js` — `/api/github` now calls `fetchAllRanges()`
> - `frontend/src/App.js` — hash routing, four dedicated pages, `Nav` import
> - `frontend/src/components/Nav.js` + `Nav.css` — new nav component
> - `frontend/src/components/HackerNews.js` — filter dropdowns + rank re-numbering
> - `frontend/src/components/GitHubTrending.js` — filter dropdowns + bucket picker
> - `frontend/src/components/DevTo.js` — filter dropdowns + rank re-numbering
> - `frontend/src/utils/filterOptions.js` — shared constants (NEW)
> - `frontend/src/components/shared.css` — `.filter-row` etc. (NEW rules)
>
> Sections in this doc that **are** still reasonably current (as of
> 2026-04-11, v3.3):
>
> - [`backend/src/youtubeService.js`](#backendsrcyoutubeservicejs) — full v3.3 source (unchanged in v3.4)
> - [`frontend/src/components/YouTube.js`](#frontendsrccomponentsyoutubejs) — v3.3 source; v3.4 only refactored it to import from `utils/filterOptions.js`
>
> For prose descriptions of each change, see `README.md` and
> `CHANGES_v3.md` — those are single-source-of-truth for feature docs
> and are the files to read first. This reference doc is supplementary.

---

## Project Overview

TrendPulse is a self-hosted dashboard that displays trending content from YouTube
(user-selectable: 1–20 days × 5–50 videos, across 11 categories), Hacker News,
GitHub Trending, and Dev.to — auto-refreshing every 30 minutes. It runs entirely
in Docker and is accessible from any device on your home network.

**Stack:** Node.js + Express (backend) · React (frontend) · nginx (reverse proxy) · Docker Compose

**Key features:** 30-min cache with stale fallback · retry logic · rate limiting ·
security headers · structured logging · React error boundaries · 90+ tests

---

## Directory Structure

```
trending-dashboard/
├── docker-compose.yml
├── docker-compose.test.yml
├── .gitignore
├── README.md
├── PROJECT_REFERENCE.md              ← this file
├── scripts/
│   └── run-tests.sh
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── Dockerfile
│   ├── Dockerfile.test
│   ├── .env.example
│   ├── src/
│   │   ├── logger.js
│   │   ├── httpClient.js
│   │   ├── cacheManager.js
│   │   └── youtubeService.js
│   └── tests/
│       ├── setup.js
│       ├── api.test.js
│       ├── youtubeService.test.js
│       └── cacheManager.test.js
└── frontend/
    ├── Dockerfile
    ├── Dockerfile.test
    ├── nginx.conf
    ├── package.json
    └── src/
        ├── index.js
        ├── index.css
        ├── App.js
        ├── App.css
        ├── utils/
        │   ├── formatters.js
        │   └── __tests__/
        │       └── formatters.test.js
        ├── hooks/
        │   ├── useTrending.js
        │   └── __tests__/
        │       └── useTrending.test.js
        └── components/
            ├── Header.js
            ├── Header.css
            ├── YouTube.js
            ├── YouTube.css
            ├── ErrorBoundary.js
            ├── ErrorBoundary.css
            └── __tests__/
                ├── YouTube.test.js
                └── ErrorBoundary.test.js
```

---

## Quick Start

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — paste your YOUTUBE_API_KEY
docker compose up -d --build
# Open http://YOUR-SERVER-IP:8080
```

---

# ════════════════════════════════════════════
# ROOT CONFIG FILES
# ════════════════════════════════════════════

## .gitignore

```
# Environment files — NEVER commit these
backend/.env

# Dependencies
backend/node_modules/
frontend/node_modules/

# React build output
frontend/build/

# Docker
.docker/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Editor
.vscode/
.idea/
*.swp
*.swo
```

---

## docker-compose.yml

```yaml
version: "3.9"

services:

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: trendpulse-backend
    restart: unless-stopped
    env_file:
      - ./backend/.env
    environment:
      - NODE_ENV=production
      - PORT=3001
    expose:
      - "3001"
    volumes:
      - ./backend/logs:/app/logs
    networks:
      - trendpulse-net
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: trendpulse-frontend
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - trendpulse-net

  # Run with: docker compose --profile test run --rm test
  test:
    build:
      context: ./backend
      dockerfile: Dockerfile.test
    container_name: trendpulse-test
    environment:
      - NODE_ENV=test
      - YOUTUBE_API_KEY=test-youtube-key
      - LOG_LEVEL=silent
    networks:
      - trendpulse-net
    profiles:
      - test

networks:
  trendpulse-net:
    driver: bridge
```

---

## docker-compose.test.yml

```yaml
version: "3.9"

# Run with: docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
# Exit code mirrors test results (0 = pass, non-zero = fail)

services:

  backend-test:
    build:
      context: ./backend
      dockerfile: Dockerfile.test
    container_name: trendpulse-backend-test
    environment:
      - NODE_ENV=test
      - YOUTUBE_API_KEY=test-youtube-key-12345
    networks:
      - test-net

  frontend-test:
    build:
      context: ./frontend
      dockerfile: Dockerfile.test
    container_name: trendpulse-frontend-test
    environment:
      - CI=true
    networks:
      - test-net

networks:
  test-net:
    driver: bridge
```

---

## scripts/run-tests.sh

```bash
#!/usr/bin/env bash
# run-tests.sh — Run all tests locally (backend + frontend)
# Usage: ./scripts/run-tests.sh [--coverage]

set -e

COVERAGE=""
if [[ "$1" == "--coverage" ]]; then
  COVERAGE="1"
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0

print_header() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

print_header "📡 TrendPulse — Test Suite"
echo "Root: $ROOT_DIR"
echo ""

# ─── Backend Tests ────────────────────────────────────────────────────────────
print_header "🟢 Backend Tests (Jest)"
cd "$ROOT_DIR/backend"

if [ ! -d node_modules ]; then
  echo "Installing backend dependencies..."
  npm install
fi

if [ -n "$COVERAGE" ]; then
  npm run test:coverage && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
else
  npm test && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
fi

# ─── Frontend Tests ───────────────────────────────────────────────────────────
print_header "🔵 Frontend Tests (React Testing Library)"
cd "$ROOT_DIR/frontend"

if [ ! -d node_modules ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

if [ -n "$COVERAGE" ]; then
  npm run test:coverage && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
else
  npm test && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
print_header "📊 Results"
echo "  ✅ Passed suites: $PASS"
echo "  ❌ Failed suites: $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  ⚠️  Some tests failed. See output above."
  exit 1
else
  echo "  🎉 All tests passed!"
  exit 0
fi
```

---

# ════════════════════════════════════════════
# BACKEND
# ════════════════════════════════════════════

## backend/Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

---

## backend/Dockerfile.test

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
# Install ALL deps including devDependencies for testing
RUN npm install
COPY . .
# Create logs directory (logger needs it even in test mode)
RUN mkdir -p logs
CMD ["npm", "test"]
```

---

## backend/.env.example

```env
# ─── YouTube ──────────────────────────────────
# Get from: https://console.cloud.google.com → YouTube Data API v3
YOUTUBE_API_KEY=your_youtube_api_key_here

# ─── Server ───────────────────────────────────
PORT=3001
```

---

## backend/package.json

```json
{
  "name": "trending-dashboard-backend",
  "version": "2.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest --runInBand --forceExit",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage --runInBand --forceExit",
    "test:ci": "jest --runInBand --forceExit --ci --coverage"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "axios-retry": "^4.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "node-cache": "^5.1.2",
    "winston": "^3.11.0",
    "winston-daily-rotate-file": "^4.7.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "nock": "^13.4.0",
    "nodemon": "^3.0.2"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.js"],
    "globalSetup": "./tests/setup.js",
    "collectCoverageFrom": [
      "server.js",
      "src/**/*.js"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 60,
        "functions": 70,
        "lines": 70,
        "statements": 70
      }
    },
    "testTimeout": 15000
  }
}
```

---

## backend/server.js

```javascript
require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
const logger    = require("./src/logger");
const cache     = require("./src/cacheManager");
const ytService = require("./src/youtubeService");

const app = express();

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "10kb" }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
  skip: () => process.env.NODE_ENV === "test",
});

const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { error: "Too many refresh requests. Please wait a few minutes." },
  skip: () => process.env.NODE_ENV === "test",
});

app.use("/api/", apiLimiter);

// ─── Request logging ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ─── Helper ───────────────────────────────────────────────────────────────────
const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  const ytKey = process.env.YOUTUBE_API_KEY;
  const configured = !!ytKey && ytKey !== "your_youtube_api_key_here";

  res.status(configured ? 200 : 503).json({
    status: configured ? "ok" : "misconfigured",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    config: { youtube: configured },
    cache: {
      keys: cache.keys(),
      youtube: cache.getTtl("youtube_trending"),
    },
    uptime: Math.round(process.uptime()),
  });
});

app.get("/api/youtube", asyncRoute(async (req, res) => {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey || apiKey === "your_youtube_api_key_here") {
    return res.status(503).json({
      error: "YouTube API key not configured. Add YOUTUBE_API_KEY to your .env file.",
      configured: false,
    });
  }

  const { data: cached, isStale } = cache.get("youtube_trending");
  if (cached) {
    return res.json({
      data: cached,
      cachedAt: cache.getTtl("youtube_trending"),
      isStale,
      source: isStale ? "stale-cache" : "cache",
    });
  }

  try {
    const data = await ytService.fetchAllCategories(apiKey);
    cache.set("youtube_trending", data);
    return res.json({ data, source: "live", cachedAt: cache.getTtl("youtube_trending") });
  } catch (err) {
    logger.error("YouTube fetch failed", { message: err.message });
    return res.status(502).json({
      error: err.message,
      suggestion: err.message.includes("403")
        ? "Your YouTube API key may be invalid or quota exceeded."
        : "YouTube API is temporarily unavailable. Try again shortly.",
    });
  }
}));

app.get("/api/refresh", refreshLimiter, asyncRoute(async (req, res) => {
  cache.flush();
  logger.info("Cache manually flushed via /api/refresh");
  res.json({
    message: "Cache cleared. Next request will fetch fresh data.",
    timestamp: new Date().toISOString(),
  });
}));

app.get("/api/cache-status", (req, res) => {
  res.json({
    youtube: cache.getTtl("youtube_trending") || { status: "not cached" },
  });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  logger.error("Unhandled error", { message: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production"
      ? "An internal server error occurred."
      : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`TrendPulse backend v2.0 running on port ${PORT}`);
    logger.info(`YouTube configured: ${!!process.env.YOUTUBE_API_KEY}`);
  });
}

module.exports = app;
```

---

## backend/src/logger.js

```javascript
const winston = require("winston");
const path = require("path");

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level.toUpperCase()}] ${stack || message}${metaStr}`;
});

const transports = [
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: "HH:mm:ss" }),
      errors({ stack: true }),
      logFormat
    ),
  }),
];

// Only add file transports outside of test environment
if (process.env.NODE_ENV !== "test") {
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/error.log"),
      level: "error",
      format: combine(timestamp(), errors({ stack: true }), winston.format.json()),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/combined.log"),
      format: combine(timestamp(), errors({ stack: true }), winston.format.json()),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  transports,
  exitOnError: false,
});

module.exports = logger;
```

---

## backend/src/httpClient.js

```javascript
const axios = require("axios");
const axiosRetry = require("axios-retry").default;
const logger = require("./logger");

/**
 * Creates an axios instance with retry logic and timeout.
 * Retries on network errors and 5xx responses (not 4xx — those are client errors).
 */
function createHttpClient(options = {}) {
  const client = axios.create({
    timeout: options.timeout || 10000,
    headers: { "Accept-Encoding": "gzip,deflate" },
  });

  axiosRetry(client, {
    retries: options.retries || 3,
    retryDelay: (retryCount, error) => {
      const delay = axiosRetry.exponentialDelay(retryCount);
      logger.warn(`Retry attempt ${retryCount} after ${delay}ms`, {
        url: error?.config?.url,
        status: error?.response?.status,
      });
      return delay;
    },
    retryCondition: (error) => {
      return (
        axiosRetry.isNetworkError(error) ||
        (error.response && error.response.status >= 500)
      );
    },
    onRetry: (retryCount, error, requestConfig) => {
      logger.warn(`Retrying request (attempt ${retryCount})`, {
        url: requestConfig.url,
        message: error.message,
      });
    },
  });

  return client;
}

module.exports = { createHttpClient };
```

---

## backend/src/cacheManager.js

```javascript
const NodeCache = require("node-cache");
const logger = require("./logger");

const CACHE_TTL  = 1800; // 30 minutes
const STALE_TTL  = 3600; // 60 minutes stale fallback
const cache      = new NodeCache({ stdTTL: CACHE_TTL, useClones: false });
const staleCache = new NodeCache({ stdTTL: STALE_TTL, useClones: false });

function get(key) {
  const fresh = cache.get(key);
  if (fresh !== undefined) return { data: fresh, isStale: false };

  const stale = staleCache.get(key);
  if (stale !== undefined) {
    logger.warn(`Cache: serving stale data for key "${key}"`);
    return { data: stale, isStale: true };
  }

  return { data: null, isStale: false };
}

function set(key, value) {
  cache.set(key, value);
  staleCache.set(key, value);
  logger.info(`Cache: stored data for key "${key}"`);
}

function getTtl(key) {
  const ttl = cache.getTtl(key);
  if (!ttl) return null;
  return {
    expiresAt: new Date(ttl).toISOString(),
    secondsLeft: Math.max(0, Math.round((ttl - Date.now()) / 1000)),
  };
}

function flush() {
  cache.flushAll();
  logger.info("Cache: fresh cache flushed");
}

function flushAll() {
  cache.flushAll();
  staleCache.flushAll();
  logger.info("Cache: all caches flushed");
}

function keys() {
  return cache.keys();
}

module.exports = { get, set, getTtl, flush, flushAll, keys };
```

---

## backend/src/youtubeService.js

*Snapshot as of v3.3 (2026-04-11). See the live file in the repo for
the canonical source. This block is kept in sync manually and may drift
between releases — if you're auditing behaviour, read the real file.*

```javascript
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

function validateApiKey(key) {
  if (!key || typeof key !== "string" || key.trim() === "") {
    throw new Error("YouTube API key is missing or invalid");
  }
}

// ISO 8601 cutoff for `search.list?publishedAfter`. Matches MAX_AGE_MS so the
// search param and the local isRecent() filter use the same outer boundary.
function getPublishedAfterCutoff() {
  return new Date(Date.now() - MAX_AGE_MS).toISOString();
}

// Rejects videos that are unplayable via the public watch URL, even when the
// Data API reports them as `public` + `processed`. See isPlayable() JSDoc in
// the live file for the full list of rules — notably the rights-gated case
// where `statistics.viewCount` is missing entirely (ESPN/NFL-style leaks).
function isPlayable(item) {
  if (!item || !item.id || !item.snippet) return false;

  const status = item.status || {};
  if (status.uploadStatus && status.uploadStatus !== "processed") return false;
  if (status.privacyStatus && status.privacyStatus !== "public") return false;

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

// BACKEND outer recency guardrail (21 days). The frontend applies a finer
// user-selected filter on top. `nowMs` is injectable for testability.
function isRecent(item, nowMs = Date.now()) {
  const pa = item?.snippet?.publishedAt;
  if (!pa) return false;
  const ts = Date.parse(pa);
  if (Number.isNaN(ts)) return false;
  return (nowMs - ts) <= MAX_AGE_MS;
}

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

// Two-pass fetch per category: search.list → videos.list. Falls back to
// chart=mostPopular (no date filter) when search returns fewer than 5 IDs,
// and runs isPlayable + isRecent on both paths before normalisation.
async function fetchCategory(client, apiKey, catId, catName) {
  try {
    const publishedAfter = getPublishedAfterCutoff();
    const nowMs = Date.now();

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
      // Pass 2: details for the found IDs
      const detailRes = await client.get(`${YT_BASE}/videos`, {
        params: { part: VIDEO_PARTS, id: videoIds.join(","), key: apiKey },
      });
      const rawItems = detailRes.data?.items || [];
      const playable = rawItems.filter(isPlayable);
      const recent   = playable.filter((it) => isRecent(it, nowMs));
      videos = recent
        .map(normalizeVideo)
        .filter(Boolean)
        .sort((a, b) => b.views - a.views);
    } else {
      // Fallback: mostPopular chart
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
      const recent   = playable.filter((it) => isRecent(it, nowMs));
      videos = recent.map(normalizeVideo).filter(Boolean);
    }

    return videos;
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.error?.message || err.message;
    if (status === 403) {
      throw new Error(`YouTube API error (403): ${message}`);
    }
    logger.error(`YouTube fetch failed for category "${catName}"`, { status, message });
    return [];
  }
}

async function fetchAllCategories(apiKey) {
  validateApiKey(apiKey);
  const client = createHttpClient({ timeout: 15000, retries: 3 });
  const results = {};
  const entries = Object.entries(YT_CATEGORIES);
  const fetched = await Promise.all(
    entries.map(([id, name]) => fetchCategory(client, apiKey, id, name))
  );
  entries.forEach(([, name], i) => { results[name] = fetched[i]; });
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
```

---

## backend/tests/setup.js

```javascript
// Jest globalSetup — runs once before all test suites
module.exports = async function globalSetup() {
  process.env.NODE_ENV        = "test";
  process.env.YOUTUBE_API_KEY = "test-youtube-key-12345";
  process.env.PORT            = "3099";
  process.env.LOG_LEVEL       = "silent";
};
```

---

## backend/tests/api.test.js

```javascript
"use strict";
process.env.NODE_ENV        = "test";
process.env.YOUTUBE_API_KEY = "test-youtube-key-12345";
process.env.LOG_LEVEL       = "silent";

const request = require("supertest");
const nock    = require("nock");

const YT_BASE = "https://www.googleapis.com";

function mockYouTubeSuccess(times = 11) {
  nock(YT_BASE)
    .get("/youtube/v3/videos")
    .query(true)
    .times(times)
    .reply(200, {
      items: [{
        id: "vid1",
        snippet: {
          title: "Trending Video",
          channelTitle: "Big Channel",
          publishedAt: "2024-01-20T08:00:00Z",
          description: "A great video",
          thumbnails: { high: { url: "https://img.youtube.com/vi/vid1/hq.jpg" } },
        },
        statistics: { viewCount: "2000000", likeCount: "50000" },
      }],
    });
}

describe("GET /api/health", () => {
  let app, cache;
  beforeEach(() => { jest.resetModules(); app = require("../server"); cache = require("../src/cacheManager"); cache.flushAll(); nock.cleanAll(); });
  afterEach(() => { nock.cleanAll(); cache.flushAll(); });

  test("returns 200 with valid key", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.version).toBe("2.0.0");
    expect(res.body.config).toEqual({ youtube: true });
    expect(typeof res.body.uptime).toBe("number");
  });

  test("returns 503 when placeholder key is set", async () => {
    process.env.YOUTUBE_API_KEY = "your_youtube_api_key_here";
    jest.resetModules();
    const a = require("../server");
    const res = await request(a).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.config.youtube).toBe(false);
    process.env.YOUTUBE_API_KEY = "test-youtube-key-12345";
  });

  test("includes cache info in response", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body.cache).toHaveProperty("keys");
    expect(res.body.cache).toHaveProperty("youtube");
  });
});

describe("GET /api/youtube", () => {
  let app, cache;
  beforeEach(() => { jest.resetModules(); app = require("../server"); cache = require("../src/cacheManager"); cache.flushAll(); nock.cleanAll(); });
  afterEach(() => { nock.cleanAll(); cache.flushAll(); });

  test("returns 503 when key is placeholder", async () => {
    process.env.YOUTUBE_API_KEY = "your_youtube_api_key_here";
    jest.resetModules();
    const a = require("../server");
    const res = await request(a).get("/api/youtube");
    expect(res.status).toBe(503);
    expect(res.body.configured).toBe(false);
    process.env.YOUTUBE_API_KEY = "test-youtube-key-12345";
  });

  test("returns 200 with structured data on success", async () => {
    mockYouTubeSuccess();
    const res = await request(app).get("/api/youtube");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("All");
    expect(Array.isArray(res.body.data.All)).toBe(true);
    expect(res.body.source).toBe("live");
  });

  test("serves from cache on second request", async () => {
    mockYouTubeSuccess();
    await request(app).get("/api/youtube");
    const res = await request(app).get("/api/youtube");
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("cache");
    expect(res.body.isStale).toBe(false);
  });

  test("video response has correct shape", async () => {
    mockYouTubeSuccess();
    const res = await request(app).get("/api/youtube");
    const video = res.body.data.All[0];
    expect(video).toHaveProperty("id");
    expect(video).toHaveProperty("title");
    expect(video).toHaveProperty("channel");
    expect(video).toHaveProperty("views");
    expect(video).toHaveProperty("likes");
    expect(video).toHaveProperty("url");
    expect(video.url).toMatch(/^https:\/\/www\.youtube\.com\/watch/);
  });

  test("returns 502 with quota suggestion on 403", async () => {
    nock(YT_BASE).get("/youtube/v3/videos").query(true)
      .reply(403, { error: { message: "quotaExceeded" } });
    const res = await request(app).get("/api/youtube");
    expect(res.status).toBe(502);
    expect(res.body.suggestion).toMatch(/quota/i);
  });

  test("returns 502 when YouTube API is unreachable", async () => {
    nock(YT_BASE).get("/youtube/v3/videos").query(true).replyWithError("ECONNREFUSED");
    const res = await request(app).get("/api/youtube");
    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty("error");
  });
});

describe("GET /api/refresh", () => {
  let app, cache;
  beforeEach(() => { jest.resetModules(); app = require("../server"); cache = require("../src/cacheManager"); cache.flushAll(); nock.cleanAll(); });
  afterEach(() => { nock.cleanAll(); cache.flushAll(); });

  test("clears cache and returns 200", async () => {
    cache.set("youtube_trending", { All: [] });
    expect(cache.keys()).toContain("youtube_trending");
    const res = await request(app).get("/api/refresh");
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/cleared/i);
    expect(cache.keys()).not.toContain("youtube_trending");
  });

  test("response contains a valid ISO timestamp", async () => {
    const res = await request(app).get("/api/refresh");
    expect(res.body).toHaveProperty("timestamp");
    expect(() => new Date(res.body.timestamp)).not.toThrow();
  });
});

describe("GET /api/cache-status", () => {
  let app, cache;
  beforeEach(() => { jest.resetModules(); app = require("../server"); cache = require("../src/cacheManager"); cache.flushAll(); nock.cleanAll(); });
  afterEach(() => { nock.cleanAll(); cache.flushAll(); });

  test("shows not-cached when empty", async () => {
    const res = await request(app).get("/api/cache-status");
    expect(res.status).toBe(200);
    expect(res.body.youtube.status).toBe("not cached");
    expect(res.body).not.toHaveProperty("reddit");
  });

  test("shows TTL info after data is cached", async () => {
    cache.set("youtube_trending", { All: [] });
    const res = await request(app).get("/api/cache-status");
    expect(res.body.youtube).toHaveProperty("secondsLeft");
    expect(res.body.youtube.secondsLeft).toBeGreaterThan(0);
  });
});

describe("404 and error handling", () => {
  let app;
  beforeEach(() => { jest.resetModules(); app = require("../server"); nock.cleanAll(); });
  afterEach(() => { nock.cleanAll(); });

  test("returns 404 for unknown route", async () => {
    const res = await request(app).get("/api/doesnotexist");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test("returns 404 for /api/reddit (removed endpoint)", async () => {
    const res = await request(app).get("/api/reddit");
    expect(res.status).toBe(404);
  });

  test("returns 404 for unsupported HTTP method", async () => {
    const res = await request(app).delete("/api/health");
    expect(res.status).toBe(404);
  });
});

describe("Security headers", () => {
  let app;
  beforeEach(() => { jest.resetModules(); app = require("../server"); nock.cleanAll(); });
  afterEach(() => { nock.cleanAll(); });

  test("X-Content-Type-Options is nosniff", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  test("X-Frame-Options header is present", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });
});
```

---

## backend/tests/youtubeService.test.js

```javascript
require("./setup");
const nock = require("nock");
const { fetchAllCategories, normalizeVideo, validateApiKey, YT_CATEGORIES } = require("../src/youtubeService");

const YT_BASE = "https://www.googleapis.com";

function makeYtItem(overrides = {}) {
  return {
    id: "abc123",
    snippet: {
      title: "Test Video Title",
      channelTitle: "Test Channel",
      publishedAt: "2024-01-15T10:00:00Z",
      description: "A test video description that is quite long and should be truncated properly.",
      thumbnails: {
        high: { url: "https://img.youtube.com/vi/abc123/hqdefault.jpg" },
        default: { url: "https://img.youtube.com/vi/abc123/default.jpg" },
      },
    },
    statistics: { viewCount: "1500000", likeCount: "45000" },
    ...overrides,
  };
}

function makeYtResponse(items = [makeYtItem()]) {
  return { items };
}

describe("validateApiKey", () => {
  test("does not throw for a valid key", () => {
    expect(() => validateApiKey("AIzaSyValidKey123")).not.toThrow();
  });
  test("throws for undefined key", () => {
    expect(() => validateApiKey(undefined)).toThrow("missing or invalid");
  });
  test("throws for empty string", () => {
    expect(() => validateApiKey("")).toThrow("missing or invalid");
  });
  test("throws for whitespace-only string", () => {
    expect(() => validateApiKey("   ")).toThrow("missing or invalid");
  });
  test("throws for non-string value", () => {
    expect(() => validateApiKey(12345)).toThrow("missing or invalid");
    expect(() => validateApiKey(null)).toThrow("missing or invalid");
  });
});

describe("normalizeVideo", () => {
  test("maps all fields correctly from a full item", () => {
    const result = normalizeVideo(makeYtItem());
    expect(result).toMatchObject({
      id: "abc123",
      title: "Test Video Title",
      channel: "Test Channel",
      url: "https://www.youtube.com/watch?v=abc123",
      views: 1500000,
      likes: 45000,
    });
  });
  test("truncates description to 120 chars + ellipsis", () => {
    const longDesc = "A".repeat(200);
    const item = makeYtItem({ snippet: { ...makeYtItem().snippet, description: longDesc } });
    const result = normalizeVideo(item);
    expect(result.description.length).toBeLessThanOrEqual(124);
    expect(result.description).toMatch(/…$/);
  });
  test("falls back to medium then default thumbnail", () => {
    const item = makeYtItem();
    delete item.snippet.thumbnails.high;
    item.snippet.thumbnails.medium = { url: "https://img.youtube.com/medium.jpg" };
    const result = normalizeVideo(item);
    expect(result.thumbnail).toBe("https://img.youtube.com/medium.jpg");
  });
  test("returns null thumbnail when none available", () => {
    const item = makeYtItem();
    item.snippet.thumbnails = {};
    expect(normalizeVideo(item).thumbnail).toBeNull();
  });
  test("handles missing statistics gracefully", () => {
    const item = makeYtItem();
    delete item.statistics;
    const result = normalizeVideo(item);
    expect(result.views).toBe(0);
    expect(result.likes).toBe(0);
  });
  test("returns null for null input", () => {
    expect(normalizeVideo(null)).toBeNull();
  });
  test("returns null for item missing id", () => {
    const item = makeYtItem();
    delete item.id;
    expect(normalizeVideo(item)).toBeNull();
  });
  test("returns null for item missing snippet", () => {
    const item = makeYtItem();
    delete item.snippet;
    expect(normalizeVideo(item)).toBeNull();
  });
  test("uses fallback title 'Untitled' when title is missing", () => {
    const item = makeYtItem();
    delete item.snippet.title;
    expect(normalizeVideo(item).title).toBe("Untitled");
  });
});

describe("fetchAllCategories (YouTube)", () => {
  afterEach(() => { nock.cleanAll(); });

  test("throws when API key is invalid", async () => {
    await expect(fetchAllCategories("")).rejects.toThrow("missing or invalid");
  });

  test("returns all category keys on success", async () => {
    const categoryCount = Object.keys(YT_CATEGORIES).length;
    nock(YT_BASE).get("/youtube/v3/videos").query(true).times(categoryCount).reply(200, makeYtResponse());
    const result = await fetchAllCategories("valid-key");
    expect(Object.keys(result)).toHaveLength(categoryCount);
    expect(result).toHaveProperty("All");
    expect(result).toHaveProperty("Gaming");
    expect(result).toHaveProperty("Music");
  });

  test("returns empty array for a category when API call fails", async () => {
    const categoryCount = Object.keys(YT_CATEGORIES).length;
    nock(YT_BASE).get("/youtube/v3/videos").query(true).times(categoryCount - 1).reply(200, makeYtResponse())
      .get("/youtube/v3/videos").query(true).once().reply(500, { error: { message: "Internal Server Error" } });
    const result = await fetchAllCategories("valid-key");
    expect(Object.keys(result).length).toBe(categoryCount);
  });

  test("throws on 403 quota exceeded", async () => {
    nock(YT_BASE).get("/youtube/v3/videos").query(true).reply(403, { error: { message: "quotaExceeded" } });
    await expect(fetchAllCategories("valid-key")).rejects.toThrow("403");
  });

  test("handles empty items array in response", async () => {
    const categoryCount = Object.keys(YT_CATEGORIES).length;
    nock(YT_BASE).get("/youtube/v3/videos").query(true).times(categoryCount).reply(200, { items: [] });
    const result = await fetchAllCategories("valid-key");
    Object.values(result).forEach((videos) => { expect(videos).toEqual([]); });
  });
});
```

---

## backend/tests/cacheManager.test.js

```javascript
require("./setup");

let cache;

beforeEach(() => {
  jest.resetModules();
  cache = require("../src/cacheManager");
  cache.flushAll();
});

describe("cacheManager", () => {
  describe("get and set", () => {
    test("returns null when key does not exist", () => {
      expect(cache.get("nonexistent-key")).toEqual({ data: null, isStale: false });
    });
    test("returns fresh data immediately after set", () => {
      cache.set("test-key", { items: [1, 2, 3] });
      const result = cache.get("test-key");
      expect(result.data).toEqual({ items: [1, 2, 3] });
      expect(result.isStale).toBe(false);
    });
    test("stores and retrieves complex objects", () => {
      const payload = { All: [{ id: "v1", title: "Video 1", views: 1000000 }] };
      cache.set("youtube_trending", payload);
      expect(cache.get("youtube_trending").data).toEqual(payload);
    });
    test("overwrites existing value on re-set", () => {
      cache.set("key", "first-value");
      cache.set("key", "second-value");
      expect(cache.get("key").data).toBe("second-value");
    });
  });

  describe("getTtl", () => {
    test("returns null for non-existent key", () => {
      expect(cache.getTtl("no-such-key")).toBeNull();
    });
    test("returns ttl object with expiresAt and secondsLeft after set", () => {
      cache.set("ttl-key", "value");
      const ttl = cache.getTtl("ttl-key");
      expect(ttl).toHaveProperty("expiresAt");
      expect(ttl).toHaveProperty("secondsLeft");
      expect(ttl.secondsLeft).toBeGreaterThan(0);
      expect(ttl.secondsLeft).toBeLessThanOrEqual(1800);
    });
    test("expiresAt is a valid ISO string", () => {
      cache.set("iso-key", "value");
      const ttl = cache.getTtl("iso-key");
      expect(new Date(ttl.expiresAt).toISOString()).toBe(ttl.expiresAt);
    });
  });

  describe("flush", () => {
    test("flush clears fresh cache", () => {
      cache.set("a", "1");
      cache.set("b", "2");
      cache.flush();
      expect(cache.get("a").data).toBeNull();
      expect(cache.get("b").data).toBeNull();
    });
    test("flushAll clears everything including stale", () => {
      cache.set("a", "1");
      cache.flushAll();
      const result = cache.get("a");
      expect(result.data).toBeNull();
      expect(result.isStale).toBe(false);
    });
  });

  describe("keys", () => {
    test("returns empty array when cache is empty", () => {
      expect(cache.keys()).toEqual([]);
    });
    test("returns all stored keys", () => {
      cache.set("youtube_trending", {});
      cache.set("youtube_trending_2", {});
      const keys = cache.keys();
      expect(keys).toContain("youtube_trending");
      expect(keys).toContain("youtube_trending_2");
      expect(keys.length).toBe(2);
    });
    test("reflects removed keys after flush", () => {
      cache.set("temp", "value");
      expect(cache.keys()).toContain("temp");
      cache.flush();
      expect(cache.keys()).not.toContain("temp");
    });
  });
});
```

---

# ════════════════════════════════════════════
# FRONTEND
# ════════════════════════════════════════════

## frontend/Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

# Serve stage with nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## frontend/Dockerfile.test

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
# CI=true makes react-scripts test run once (no watch) and exit with correct code
ENV CI=true
CMD ["npm", "test"]
```

---

## frontend/nginx.conf

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 256;
}
```

---

## frontend/package.json

```json
{
  "name": "trending-dashboard-frontend",
  "version": "2.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  },
  "devDependencies": {
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/user-event": "^14.5.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test --watchAll=false",
    "test:watch": "react-scripts test",
    "test:coverage": "react-scripts test --coverage --watchAll=false"
  },
  "proxy": "http://backend:3001",
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version"]
  }
}
```

---

## frontend/public/index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Trending Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

---

## frontend/src/index.js

```javascript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<React.StrictMode><App /></React.StrictMode>);
```

---

## frontend/src/index.css

```css
:root {
  --bg-primary: #080c10;
  --bg-secondary: #0d1117;
  --bg-card: #111820;
  --bg-card-hover: #161e28;
  --border: #1e2d3d;
  --border-glow: #2a4a6b;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #484f58;
  --accent-yt: #ff4444;
  --accent-yt-glow: rgba(255, 68, 68, 0.15);
  --accent-blue: #58a6ff;
  --accent-green: #3fb950;
  --accent-purple: #bc8cff;
  --font-display: 'Syne', sans-serif;
  --font-mono: 'Space Mono', monospace;
  --radius: 8px;
  --radius-lg: 14px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-display);
  min-height: 100vh;
  overflow-x: hidden;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 40% at 20% 0%, rgba(88, 166, 255, 0.04) 0%, transparent 60%),
    radial-gradient(ellipse 60% 30% at 80% 100%, rgba(255, 68, 68, 0.04) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}

#root { position: relative; z-index: 1; }

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg-secondary); }
::-webkit-scrollbar-thumb { background: var(--border-glow); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--accent-blue); }

a { color: inherit; text-decoration: none; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}

.skeleton {
  background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-card-hover) 50%, var(--bg-card) 75%);
  background-size: 400px 100%;
  animation: shimmer 1.4s ease infinite;
  border-radius: var(--radius);
}
```

---

## frontend/src/App.js

```javascript
import React, { useState, useCallback } from "react";
import Header from "./components/Header";
import YouTube from "./components/YouTube";
import ErrorBoundary from "./components/ErrorBoundary";
import { useTrending } from "./hooks/useTrending";
import "./App.css";

export default function App() {
  const [refreshing, setRefreshing] = useState(false);
  const yt = useTrending("youtube");

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await yt.manualRefresh();
    setRefreshing(false);
  }, [yt]);

  return (
    <div className="app">
      <ErrorBoundary title="Header failed to load">
        <Header
          lastUpdated={yt.lastUpdated}
          nextRefresh={yt.nextRefresh}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      </ErrorBoundary>

      <main className="dashboard-main">
        <ErrorBoundary title="YouTube section encountered an error">
          <YouTube data={yt.data} loading={yt.loading} error={yt.error} />
        </ErrorBoundary>
      </main>

      <footer className="app-footer">
        <span>TrendPulse v2.0</span>
        <span className="footer-dot">·</span>
        <span>Auto-refreshes every 30 minutes</span>
        <span className="footer-dot">·</span>
        <span>Powered by YouTube Data API</span>
      </footer>
    </div>
  );
}
```

---

## frontend/src/App.css

```css
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.dashboard-main {
  flex: 1;
  padding: 28px 32px;
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
  animation: fadeInUp 0.4s ease both;
}

.app-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 32px;
  border-top: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.footer-dot { color: var(--border-glow); }

@media (max-width: 640px) {
  .dashboard-main { padding: 16px; }
  .app-footer { flex-wrap: wrap; gap: 6px; }
}
```

---

## frontend/src/utils/formatters.js

```javascript
export function formatNum(n) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "";
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(diff / 3600000);
  const days    = Math.floor(diff / 86400000);
  if (days > 0)    return `${days}d ago`;
  if (hours > 0)   return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export function truncate(str, maxLen = 120) {
  if (!str || typeof str !== "string") return "";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

export function formatScore(n) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export function isValidThumbnail(url) {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

export function formatCountdown(totalSeconds) {
  if (!totalSeconds || totalSeconds < 0) return "0m 00s";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
```

---

## frontend/src/hooks/useTrending.js

```javascript
import { useState, useEffect, useCallback } from "react";

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

export function useTrending(platform) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nextRefresh, setNextRefresh] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${platform}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
      setLastUpdated(new Date());
      setNextRefresh(new Date(Date.now() + REFRESH_INTERVAL));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const manualRefresh = useCallback(async () => {
    await fetch("/api/refresh");
    fetchData();
  }, [fetchData]);

  return { data, loading, error, lastUpdated, nextRefresh, manualRefresh };
}

export function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = Math.max(0, targetDate - Date.now());
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}m ${s.toString().padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}
```

---

## frontend/src/components/Header.js

```javascript
import React from "react";
import { useCountdown } from "../hooks/useTrending";
import "./Header.css";

export default function Header({ lastUpdated, nextRefresh, onRefresh, refreshing }) {
  const countdown = useCountdown(nextRefresh);

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <div className="logo">
          <div className="logo-icon"><span>📡</span></div>
          <div>
            <h1 className="logo-title">TREND<span className="logo-accent">PULSE</span></h1>
            <p className="logo-sub">Live Trending Dashboard</p>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="status-grid">
          {lastUpdated && (
            <div className="status-item">
              <span className="status-dot active" />
              <div>
                <p className="status-label">Last Updated</p>
                <p className="status-value">{lastUpdated.toLocaleTimeString()}</p>
              </div>
            </div>
          )}
          {nextRefresh && (
            <div className="status-item">
              <span className="status-dot pulse" />
              <div>
                <p className="status-label">Next Refresh</p>
                <p className="status-value countdown">{countdown}</p>
              </div>
            </div>
          )}
        </div>

        <button
          className={`refresh-btn ${refreshing ? "refreshing" : ""}`}
          onClick={onRefresh}
          disabled={refreshing}
          title="Force refresh"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"
            className={refreshing ? "spin" : ""}>
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {refreshing ? "Refreshing…" : "Refresh Now"}
        </button>
      </div>
    </header>
  );
}
```

---

## frontend/src/components/Header.css

```css
.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 32px;
  border-bottom: 1px solid var(--border);
  background: rgba(13, 17, 23, 0.95);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 100;
  gap: 20px;
  flex-wrap: wrap;
}

.header-left { display: flex; align-items: center; }

.logo { display: flex; align-items: center; gap: 14px; }

.logo-icon {
  width: 44px; height: 44px;
  background: linear-gradient(135deg, rgba(88, 166, 255, 0.15), rgba(255, 68, 68, 0.1));
  border: 1px solid var(--border-glow);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
}

.logo-title {
  font-family: var(--font-display);
  font-size: 22px; font-weight: 800; letter-spacing: 2px;
  color: var(--text-primary); line-height: 1;
}

.logo-accent { color: var(--accent-blue); }

.logo-sub {
  font-family: var(--font-mono);
  font-size: 10px; color: var(--text-muted);
  letter-spacing: 1px; margin-top: 3px;
}

.header-right { display: flex; align-items: center; gap: 20px; }
.status-grid { display: flex; gap: 20px; flex-wrap: wrap; }
.status-item { display: flex; align-items: center; gap: 8px; }

.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-dot.active { background: var(--accent-green); }
.status-dot.pulse { background: var(--accent-blue); animation: pulse 2s ease infinite; }

.status-label {
  font-family: var(--font-mono); font-size: 9px;
  color: var(--text-muted); letter-spacing: 0.5px; text-transform: uppercase;
}
.status-value { font-family: var(--font-mono); font-size: 12px; color: var(--text-primary); font-weight: 700; }
.status-value.countdown { color: var(--accent-blue); font-size: 13px; }

.refresh-btn {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-card); border: 1px solid var(--border);
  color: var(--text-secondary); padding: 8px 16px;
  border-radius: var(--radius); font-family: var(--font-display);
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all 0.2s; white-space: nowrap;
}
.refresh-btn:hover:not(:disabled) {
  background: var(--bg-card-hover); border-color: var(--accent-blue); color: var(--accent-blue);
}
.refresh-btn.refreshing { opacity: 0.6; cursor: not-allowed; }
.refresh-btn svg.spin { animation: spin 1s linear infinite; }

@media (max-width: 640px) {
  .dashboard-header { padding: 16px; }
  .status-grid { display: none; }
  .logo-title { font-size: 18px; }
}
```

---

## frontend/src/components/YouTube.js

*Snapshot as of v3.3 (2026-04-11). See the live file for the canonical source.*

```javascript
import React, { useMemo, useState } from "react";
import { formatNum, timeAgo, isValidThumbnail } from "../utils/formatters";
import "./shared.css";
import "./YouTube.css";

// ── User-adjustable filter options ────────────────────────────────────────────
// These drive the two dropdowns above the category tabs. Keep them in sync
// with the backend's MAX_AGE_MS (21 days) and MAX_RESULTS (50) — if either
// list exceeds those constants, the backend won't have data to fill the pick.
const TIME_FRAME_OPTIONS = [
  { days: 1,  label: "Past 1 day"   },
  { days: 2,  label: "Past 2 days"  },
  { days: 3,  label: "Past 3 days"  },
  { days: 5,  label: "Past 5 days"  },
  { days: 10, label: "Past 10 days" },
  { days: 20, label: "Past 20 days" },
];
const COUNT_OPTIONS = [5, 10, 15, 20, 25, 50];

const DEFAULT_TIME_FRAME_DAYS = 1;
const DEFAULT_COUNT           = 15;

function VideoCard({ video, index }) {
  const [imgError, setImgError] = useState(false);
  const hasThumbnail = isValidThumbnail(video.thumbnail) && !imgError;
  return (
    <a href={video.url} target="_blank" rel="noreferrer" className="video-card">
      <div className="video-rank">#{index + 1}</div>
      <div className="video-thumb-wrap">
        {hasThumbnail ? (
          <img src={video.thumbnail} alt={video.title} onError={() => setImgError(true)} />
        ) : (
          <div className="video-thumb-placeholder"><span>▶</span></div>
        )}
        <div className="video-play-overlay">▶</div>
      </div>
      <div className="video-info">
        <p className="video-title">{video.title}</p>
        <p className="video-channel">{video.channel}</p>
        <div className="video-stats">
          <span className="stat views">👁 {formatNum(video.views)}</span>
          <span className="stat likes">♥ {formatNum(video.likes)}</span>
          <span className="stat time">{timeAgo(video.publishedAt)}</span>
        </div>
      </div>
    </a>
  );
}

function SkeletonCard() { /* ... unchanged from v3 ... */ }

export default function YouTube({ data, loading, error }) {
  const categories = data ? Object.keys(data) : [];
  const [activeCategory, setActiveCategory] = useState("All");
  const [timeFrameDays,  setTimeFrameDays]  = useState(DEFAULT_TIME_FRAME_DAYS);
  const [count,          setCount]          = useState(DEFAULT_COUNT);

  const displayCat = data
    ? (activeCategory in data ? activeCategory : categories[0])
    : "All";
  const rawVideos = data?.[displayCat] || [];

  // Client-side filtering:
  //   1. Drop anything older than the selected time frame (by publishedAt)
  //   2. Slice the (sort-preserved) list to the selected count
  // The backend already sorts by viewCount desc and has dropped anything
  // unplayable or past the 21-day outer guardrail.
  const videos = useMemo(() => {
    if (!rawVideos.length) return rawVideos;
    const cutoffMs = Date.now() - timeFrameDays * 24 * 60 * 60 * 1000;
    return rawVideos
      .filter((v) => {
        if (!v.publishedAt) return false;
        const ts = Date.parse(v.publishedAt);
        return !Number.isNaN(ts) && ts >= cutoffMs;
      })
      .slice(0, count);
  }, [rawVideos, timeFrameDays, count]);

  const badgeLabel = useMemo(() => {
    const opt = TIME_FRAME_OPTIONS.find((o) => o.days === timeFrameDays);
    return `Trending · ${opt ? opt.label : `Past ${timeFrameDays} days`}`;
  }, [timeFrameDays]);

  return (
    <section className="yt-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-icon">▶️</span>
          <h2>YouTube</h2>
          <span className="section-badge">{badgeLabel}</span>
        </div>
        <a href="https://www.youtube.com/feed/trending" target="_blank" rel="noreferrer" className="section-link">
          youtube.com/trending ↗
        </a>
      </div>

      {error && (
        <div className="section-error"><span>⚠</span> {error}</div>
      )}

      {/* Filter row — instant client-side slicing over the cached super-set. */}
      <div className="yt-filters" role="group" aria-label="YouTube filters">
        <label className="yt-filter">
          <span className="yt-filter-label">Time frame</span>
          <select
            className="yt-select"
            value={timeFrameDays}
            onChange={(e) => setTimeFrameDays(Number(e.target.value))}
            disabled={loading}
            aria-label="Time frame"
          >
            {TIME_FRAME_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="yt-filter">
          <span className="yt-filter-label">Show</span>
          <select
            className="yt-select"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={loading}
            aria-label="Number of videos"
          >
            {COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} videos</option>
            ))}
          </select>
        </label>
      </div>

      <div className="category-tabs">
        {(loading ? ["All", "Music", "Gaming", "Entertainment", "News & Politics",
                     "Science & Technology", "Sports", "Comedy", "How-to & Style",
                     "People & Blogs", "Pets & Animals"] : categories
        ).map((cat) => (
          <button
            key={cat}
            className={`cat-tab${displayCat === cat ? " active yt-active" : ""}`}
            onClick={() => setActiveCategory(cat)}
            disabled={loading}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="video-grid">
        {loading
          ? Array.from({ length: Math.min(count, 15) }, (_, i) => <SkeletonCard key={i} />)
          : videos.length > 0
            ? videos.map((v, i) => <VideoCard key={v.id} video={v} index={i} />)
            : !error && (
                <p className="empty-state">No videos found for this category.</p>
              )}
      </div>
    </section>
  );
}
```

---

## frontend/src/components/YouTube.css

```css
.yt-section { --accent: var(--accent-yt); --glow: var(--accent-yt-glow); }

.platform-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  transition: border-color 0.3s;
}
.platform-section:hover { border-color: var(--border-glow); }

.platform-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }

.platform-badge {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-display); font-size: 16px; font-weight: 800;
  letter-spacing: 0.5px; padding: 6px 14px; border-radius: 20px;
}

.yt-badge {
  background: var(--accent-yt-glow);
  color: var(--accent-yt);
  border: 1px solid rgba(255, 68, 68, 0.3);
}

.platform-subtitle { font-size: 13px; color: var(--text-muted); font-family: var(--font-mono); letter-spacing: 0.5px; }

.error-box {
  background: rgba(255, 68, 68, 0.08); border: 1px solid rgba(255, 68, 68, 0.3);
  border-radius: var(--radius); padding: 12px 16px; color: #ff8080;
  font-size: 13px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
}

.category-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }

.cat-tab {
  background: var(--bg-card); border: 1px solid var(--border);
  color: var(--text-secondary); padding: 6px 16px; border-radius: 20px;
  font-family: var(--font-display); font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.2s; white-space: nowrap;
}
.cat-tab:hover { border-color: var(--border-glow); color: var(--text-primary); background: var(--bg-card-hover); }
.cat-tab.active { color: #fff; }
.yt-active { background: var(--accent-yt-glow); border-color: var(--accent-yt); color: var(--accent-yt); }

.video-grid { display: flex; flex-direction: column; gap: 10px; }

.video-card {
  display: flex; align-items: center; gap: 12px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 10px; cursor: pointer;
  transition: all 0.2s; animation: fadeInUp 0.3s ease both;
}
.video-card:hover { background: var(--bg-card-hover); border-color: var(--border-glow); transform: translateX(4px); }
.skeleton-card { animation: none; pointer-events: none; }

.video-rank { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); min-width: 28px; text-align: center; }

.video-thumb-wrap {
  position: relative; width: 100px; height: 56px;
  border-radius: 6px; overflow: hidden; flex-shrink: 0; background: var(--bg-primary);
}
.video-thumb-wrap img { width: 100%; height: 100%; object-fit: cover; }
.video-thumb-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 20px; }
.video-play-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.5); color: #fff; font-size: 18px; opacity: 0; transition: opacity 0.2s;
}
.video-card:hover .video-play-overlay { opacity: 1; }

.video-info { flex: 1; min-width: 0; }
.video-title { font-size: 13px; font-weight: 600; line-height: 1.4; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary); }
.video-channel { font-size: 11px; color: var(--text-secondary); margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.video-stats { display: flex; gap: 12px; flex-wrap: wrap; }
.stat { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); }
.stat.views { color: var(--accent-blue); }
.stat.likes { color: #f85149; }

.empty-state { text-align: center; color: var(--text-muted); font-family: var(--font-mono); font-size: 13px; padding: 40px 0; }
```

---

## frontend/src/components/ErrorBoundary.js

```javascript
import React from "react";
import "./ErrorBoundary.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="eb-icon">⚠</div>
          <h3 className="eb-title">{this.props.title || "Something went wrong"}</h3>
          <p className="eb-message">
            {this.state.error?.message || "An unexpected error occurred in this section."}
          </p>
          {process.env.NODE_ENV !== "production" && this.state.errorInfo && (
            <details className="eb-details">
              <summary>Stack trace</summary>
              <pre>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
          <button className="eb-retry" onClick={this.handleReset}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
```

---

## frontend/src/components/ErrorBoundary.css

```css
.error-boundary {
  background: rgba(255, 68, 68, 0.06); border: 1px solid rgba(255, 68, 68, 0.25);
  border-radius: var(--radius-lg); padding: 40px 24px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.eb-icon { font-size: 36px; color: var(--accent-yt); line-height: 1; }
.eb-title { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--text-primary); }
.eb-message { font-size: 13px; color: var(--text-secondary); max-width: 400px; line-height: 1.5; }
.eb-details { width: 100%; max-width: 600px; text-align: left; margin-top: 8px; }
.eb-details summary { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); cursor: pointer; margin-bottom: 8px; }
.eb-details pre { background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; font-size: 11px; color: var(--text-secondary); overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
.eb-retry { margin-top: 8px; background: rgba(255, 68, 68, 0.1); border: 1px solid rgba(255, 68, 68, 0.3); color: var(--accent-yt); padding: 8px 20px; border-radius: var(--radius); font-family: var(--font-display); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.eb-retry:hover { background: rgba(255, 68, 68, 0.2); border-color: var(--accent-yt); }
```

---

## frontend/src/utils/__tests__/formatters.test.js

```javascript
import { formatNum, timeAgo, truncate, formatScore, isValidThumbnail, formatCountdown } from "../../utils/formatters";

describe("formatNum", () => {
  test("formats millions with one decimal", () => {
    expect(formatNum(1500000)).toBe("1.5M");
    expect(formatNum(2000000)).toBe("2.0M");
  });
  test("formats thousands with one decimal", () => {
    expect(formatNum(12500)).toBe("12.5K");
    expect(formatNum(1000)).toBe("1.0K");
  });
  test("returns plain string for numbers under 1000", () => {
    expect(formatNum(0)).toBe("0");
    expect(formatNum(999)).toBe("999");
  });
  test("handles null and undefined safely", () => {
    expect(formatNum(null)).toBe("0");
    expect(formatNum(undefined)).toBe("0");
  });
  test("handles NaN safely", () => {
    expect(formatNum(NaN)).toBe("0");
  });
});

describe("formatScore", () => {
  test("formats thousands with k suffix", () => {
    expect(formatScore(12500)).toBe("12.5k");
  });
  test("returns plain string under 1000", () => {
    expect(formatScore(999)).toBe("999");
    expect(formatScore(0)).toBe("0");
  });
  test("handles null/undefined", () => {
    expect(formatScore(null)).toBe("0");
    expect(formatScore(undefined)).toBe("0");
  });
});

describe("timeAgo", () => {
  test("returns 'just now' for very recent timestamps", () => {
    expect(timeAgo(new Date().toISOString())).toBe("just now");
  });
  test("returns minutes ago", () => {
    const ts = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    expect(timeAgo(ts)).toBe("15m ago");
  });
  test("returns hours ago", () => {
    const ts = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(timeAgo(ts)).toBe("3h ago");
  });
  test("returns days ago", () => {
    const ts = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(timeAgo(ts)).toBe("2d ago");
  });
  test("returns empty string for null/undefined", () => {
    expect(timeAgo(null)).toBe("");
    expect(timeAgo(undefined)).toBe("");
  });
  test("returns empty string for invalid date", () => {
    expect(timeAgo("not-a-date")).toBe("");
  });
});

describe("truncate", () => {
  test("does not truncate strings shorter than maxLen", () => {
    expect(truncate("Hello", 120)).toBe("Hello");
  });
  test("truncates and appends ellipsis at maxLen", () => {
    const result = truncate("A".repeat(200), 120);
    expect(result.length).toBe(121);
    expect(result.endsWith("…")).toBe(true);
  });
  test("returns empty string for null/undefined", () => {
    expect(truncate(null)).toBe("");
    expect(truncate(undefined)).toBe("");
  });
  test("returns empty string for non-string input", () => {
    expect(truncate(12345)).toBe("");
  });
});

describe("isValidThumbnail", () => {
  test("returns true for https URLs", () => {
    expect(isValidThumbnail("https://img.youtube.com/vi/abc/hq.jpg")).toBe(true);
  });
  test("returns true for http URLs", () => {
    expect(isValidThumbnail("http://example.com/image.png")).toBe(true);
  });
  test("returns false for non-http placeholder strings", () => {
    expect(isValidThumbnail("self")).toBe(false);
    expect(isValidThumbnail("default")).toBe(false);
  });
  test("returns false for null/undefined/empty", () => {
    expect(isValidThumbnail(null)).toBe(false);
    expect(isValidThumbnail(undefined)).toBe(false);
    expect(isValidThumbnail("")).toBe(false);
  });
  test("returns false for non-string input", () => {
    expect(isValidThumbnail(123)).toBe(false);
  });
});

describe("formatCountdown", () => {
  test("formats 90 seconds as 1m 30s", () => {
    expect(formatCountdown(90)).toBe("1m 30s");
  });
  test("pads seconds with leading zero", () => {
    expect(formatCountdown(65)).toBe("1m 05s");
  });
  test("formats 0 seconds", () => {
    expect(formatCountdown(0)).toBe("0m 00s");
  });
  test("handles null/undefined/negative", () => {
    expect(formatCountdown(null)).toBe("0m 00s");
    expect(formatCountdown(-10)).toBe("0m 00s");
  });
  test("formats large values", () => {
    expect(formatCountdown(1800)).toBe("30m 00s");
  });
});
```

---

## frontend/src/components/__tests__/YouTube.test.js

*(see full source in the tar.gz — tests loading state, error state, data rendering, category switching, aria roles, empty state)*

## frontend/src/components/__tests__/ErrorBoundary.test.js

*(see full source in the tar.gz — tests child rendering, fallback UI, error message, default title, Try Again reset)*

## frontend/src/hooks/__tests__/useTrending.test.js

*(see full source in the tar.gz — tests initial load, success/failure states, auto-refresh at 30 min, manual refresh, network errors)*

---

# ════════════════════════════════════════════
# API REFERENCE
# ════════════════════════════════════════════

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service health + config status. Returns 200 if key is set, 503 if not. |
| GET | `/api/youtube` | Trending videos by category. Cached 30 min, stale fallback 60 min. |
| GET | `/api/refresh` | Clears fresh cache. Rate limited: 5 req / 5 min. |
| GET | `/api/cache-status` | Returns TTL info for the YouTube cache key. |

## YouTube Response Shape

```json
{
  "source": "live | cache | stale-cache",
  "isStale": false,
  "cachedAt": { "expiresAt": "2025-01-01T12:30:00.000Z", "secondsLeft": 1800 },
  "data": {
    "All": [
      {
        "id": "dQw4w9WgXcQ",
        "title": "Video Title",
        "channel": "Channel Name",
        "thumbnail": "https://img.youtube.com/vi/.../hqdefault.jpg",
        "views": 1500000,
        "likes": 45000,
        "publishedAt": "2025-01-01T08:00:00Z",
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "description": "First 120 chars of description…"
      }
    ],
    "Gaming": [ ... ],
    "Music": [ ... ]
  }
}
```

---

# ════════════════════════════════════════════
# DEPENDENCY SUMMARY
# ════════════════════════════════════════════

## Backend Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| axios | ^1.6.0 | HTTP client for YouTube API calls |
| axios-retry | ^4.0.0 | Exponential backoff retry logic |
| cors | ^2.8.5 | Cross-origin request headers |
| dotenv | ^16.3.1 | .env file loading |
| express | ^4.18.2 | HTTP server and routing |
| express-rate-limit | ^7.1.5 | API rate limiting |
| helmet | ^7.1.0 | Security HTTP headers |
| node-cache | ^5.1.2 | In-memory two-tier cache |
| winston | ^3.11.0 | Structured logging |
| winston-daily-rotate-file | ^4.7.1 | Rotating log files |

## Backend Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| jest | ^29.7.0 | Test runner |
| supertest | ^6.3.3 | HTTP integration testing |
| nock | ^13.4.0 | HTTP request mocking |
| nodemon | ^3.0.2 | Dev auto-restart |

## Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.2.0 | UI framework |
| react-dom | ^18.2.0 | DOM renderer |
| react-scripts | 5.0.1 | CRA build toolchain |
| @testing-library/react | ^14.1.2 | Component testing |
| @testing-library/jest-dom | ^6.1.5 | DOM matchers |
| @testing-library/user-event | ^14.5.1 | User interaction simulation |

---

# ════════════════════════════════════════════
# ENVIRONMENT VARIABLES
# ════════════════════════════════════════════

| Variable | Required | Description |
|----------|----------|-------------|
| `YOUTUBE_API_KEY` | Yes | YouTube Data API v3 key from Google Cloud Console |
| `PORT` | No | Backend port (default: 3001) |
| `NODE_ENV` | No | Set automatically by Docker (`production` / `test`) |
| `LOG_LEVEL` | No | Winston log level (default: `info`, set `silent` in tests) |
| `CORS_ORIGIN` | No | Restrict CORS origin (default: `*`) |

---

*TrendPulse v3.4 — four-page dashboard: YouTube + Hacker News + GitHub Trending + Dev.to*  
*Node.js 20 · React 18 · Docker Compose · Full jest + RTL test suite*
