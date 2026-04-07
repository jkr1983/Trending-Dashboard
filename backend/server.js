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
