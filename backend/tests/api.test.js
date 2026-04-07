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

// ─── GET /api/health ──────────────────────────────────────────────────────────
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

// ─── GET /api/youtube ─────────────────────────────────────────────────────────
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

// ─── GET /api/refresh ─────────────────────────────────────────────────────────
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

// ─── GET /api/cache-status ────────────────────────────────────────────────────
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

// ─── 404 and error handling ───────────────────────────────────────────────────
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

// ─── Security headers ─────────────────────────────────────────────────────────
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
