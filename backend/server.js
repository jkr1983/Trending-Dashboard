require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
const logger    = require("./src/logger");
const cache     = require("./src/cacheManager");
const ytService = require("./src/youtubeService");
const hnService = require("./src/hackerNewsService");
const ghService = require("./src/githubTrendingService");
const dtService = require("./src/devtoService");

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

// ─── Cache key constants ──────────────────────────────────────────────────────
const CACHE_KEYS = {
  youtube:  "youtube_trending",
  hn:       "hn_trending",
  github:   "github_trending",
  devto:    "devto_trending",
};

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  const ytKey = process.env.YOUTUBE_API_KEY;
  const ytConfigured = !!ytKey && ytKey !== "your_youtube_api_key_here";

  res.status(ytConfigured ? 200 : 503).json({
    status: ytConfigured ? "ok" : "misconfigured",
    version: "3.0.0",
    timestamp: new Date().toISOString(),
    config: {
      youtube: ytConfigured,
      hackernews: true,   // no key required
      github: true,       // no key required
      devto: true,        // no key required
    },
    cache: {
      keys: cache.keys(),
      youtube:  cache.getTtl(CACHE_KEYS.youtube),
      hn:       cache.getTtl(CACHE_KEYS.hn),
      github:   cache.getTtl(CACHE_KEYS.github),
      devto:    cache.getTtl(CACHE_KEYS.devto),
    },
    uptime: Math.round(process.uptime()),
  });
});

// ── YouTube ───────────────────────────────────────────────────────────────────
app.get("/api/youtube", asyncRoute(async (req, res) => {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey || apiKey === "your_youtube_api_key_here") {
    return res.status(503).json({
      error: "YouTube API key not configured. Add YOUTUBE_API_KEY to your .env file.",
      configured: false,
    });
  }

  const { data: cached, isStale } = cache.get(CACHE_KEYS.youtube);
  if (cached) {
    return res.json({
      data: cached,
      cachedAt: cache.getTtl(CACHE_KEYS.youtube),
      isStale,
      source: isStale ? "stale-cache" : "cache",
    });
  }

  const data = await ytService.fetchAllCategories(apiKey);
  cache.set(CACHE_KEYS.youtube, data);

  res.json({ data, cachedAt: null, isStale: false, source: "live" });
}));

// ── Hacker News ───────────────────────────────────────────────────────────────
app.get("/api/hackernews", asyncRoute(async (req, res) => {
  const { data: cached, isStale } = cache.get(CACHE_KEYS.hn);
  if (cached) {
    return res.json({
      data: cached,
      cachedAt: cache.getTtl(CACHE_KEYS.hn),
      isStale,
      source: isStale ? "stale-cache" : "cache",
    });
  }

  const data = await hnService.fetchTopStories();
  cache.set(CACHE_KEYS.hn, data);

  res.json({ data, cachedAt: null, isStale: false, source: "live" });
}));

// ── GitHub Trending ───────────────────────────────────────────────────────────
app.get("/api/github", asyncRoute(async (req, res) => {
  const { data: cached, isStale } = cache.get(CACHE_KEYS.github);
  if (cached) {
    return res.json({
      data: cached,
      cachedAt: cache.getTtl(CACHE_KEYS.github),
      isStale,
      source: isStale ? "stale-cache" : "cache",
    });
  }

  const data = await ghService.fetchTrending("daily");
  cache.set(CACHE_KEYS.github, data);

  res.json({ data, cachedAt: null, isStale: false, source: "live" });
}));

// ── Dev.to ────────────────────────────────────────────────────────────────────
app.get("/api/devto", asyncRoute(async (req, res) => {
  const { data: cached, isStale } = cache.get(CACHE_KEYS.devto);
  if (cached) {
    return res.json({
      data: cached,
      cachedAt: cache.getTtl(CACHE_KEYS.devto),
      isStale,
      source: isStale ? "stale-cache" : "cache",
    });
  }

  const data = await dtService.fetchTopArticles();
  cache.set(CACHE_KEYS.devto, data);

  res.json({ data, cachedAt: null, isStale: false, source: "live" });
}));

// ── Refresh (clears all source caches) ───────────────────────────────────────
app.get("/api/refresh", refreshLimiter, (req, res) => {
  Object.values(CACHE_KEYS).forEach((key) => cache.del(key));
  logger.info("Cache cleared for all sources");
  res.json({ message: "Cache cleared for all sources", timestamp: new Date().toISOString() });
});

// ── Cache status ──────────────────────────────────────────────────────────────
app.get("/api/cache-status", (req, res) => {
  const now = Date.now();
  const status = {};

  for (const [source, key] of Object.entries(CACHE_KEYS)) {
    const ttlMs = cache.getTtl(key);
    status[source] = ttlMs
      ? { secondsLeft: Math.round((ttlMs - now) / 1000), cachedUntil: new Date(ttlMs).toISOString() }
      : { secondsLeft: 0, cachedUntil: null };
  }

  res.json(status);
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  const status = err.response?.status || 500;
  const message = err.message || "Internal server error";
  logger.error(`Unhandled error on ${req.path}`, { status, message });

  if (status === 403 && message.includes("YouTube")) {
    return res.status(502).json({ error: "YouTube API quota exceeded or key invalid." });
  }

  res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
});

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => logger.info(`TrendPulse backend listening on port ${PORT}`));
}

module.exports = app;
