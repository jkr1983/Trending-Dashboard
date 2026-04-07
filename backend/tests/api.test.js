"use strict";
process.env.NODE_ENV        = "test";
process.env.YOUTUBE_API_KEY = "test-youtube-key-12345";
process.env.LOG_LEVEL       = "silent";

const request = require("supertest");
const nock    = require("nock");

const YT_BASE  = "https://www.googleapis.com";
const HN_BASE  = "https://hacker-news.firebaseio.com";
const GH_BASE  = "https://github.com";
const DT_BASE  = "https://dev.to";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function mockYouTubeSuccess() {
  const item = {
    id: "vid1",
    snippet: {
      title: "Trending Video",
      channelTitle: "Big Channel",
      publishedAt: new Date(Date.now() - 3600000).toISOString(), // 1h ago
      description: "A great video",
      thumbnails: { high: { url: "https://img.youtube.com/vi/vid1/hq.jpg" } },
    },
    statistics: { viewCount: "2000000", likeCount: "50000" },
  };
  const catCount = 11;
  // Two passes per category: search.list then videos.list
  nock(YT_BASE)
    .get("/youtube/v3/search")
    .query(true)
    .times(catCount)
    .reply(200, { items: [{ id: { videoId: "vid1" } }] });
  nock(YT_BASE)
    .get("/youtube/v3/videos")
    .query(true)
    .times(catCount)
    .reply(200, { items: [item] });
}

function mockHNSuccess() {
  nock(HN_BASE)
    .get("/v0/topstories.json")
    .reply(200, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  // Mock each item fetch
  for (let i = 1; i <= 15; i++) {
    nock(HN_BASE)
      .get(`/v0/item/${i}.json`)
      .reply(200, {
        id: i,
        type: "story",
        title: `HN Story ${i}`,
        url: `https://example.com/story${i}`,
        score: 100 + i,
        by: "testuser",
        descendants: 10,
        time: Math.floor(Date.now() / 1000) - 3600,
      });
  }
}

function mockGitHubSuccess() {
  const html = `
    <article class="Box-row">
      <h2><a href="/owner/repo-one">owner/repo-one</a></h2>
      <p class="color-fg-muted">A test repository description</p>
      <span itemprop="programmingLanguage">TypeScript</span>
      <a href="/owner/repo-one/stargazers">1,234</a>
      <a href="/owner/repo-one/forks">567</a>
      <span>89 stars today</span>
    </article>
  `;
  nock(GH_BASE)
    .get("/trending")
    .query(true)
    .reply(200, html, { "Content-Type": "text/html" });
}

function mockDevToSuccess() {
  const articles = Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    title: `Dev.to Article ${i + 1}`,
    url: `https://dev.to/user/article-${i + 1}`,
    description: "An interesting article",
    cover_image: null,
    tag_list: ["javascript", "webdev"],
    public_reactions_count: 50 + i,
    comments_count: 5,
    reading_time_minutes: 4,
    published_at: new Date().toISOString(),
    user: { name: "Test Author", username: "testauthor", profile_image_90: null },
  }));
  nock(DT_BASE)
    .get("/api/articles")
    .query(true)
    .reply(200, articles);
}

// ─── GET /api/health ──────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  let app, cache;
  beforeEach(() => {
    jest.resetModules();
    app   = require("../server");
    cache = require("../src/cacheManager");
    cache.flushAll();
    nock.cleanAll();
  });
  afterEach(() => { nock.cleanAll(); cache.flushAll(); });

  test("returns 200 with valid YouTube key", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.version).toBe("3.0.0");
    expect(typeof res.body.uptime).toBe("number");
  });

  test("config reports all four sources", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body.config).toEqual({
      youtube:     true,
      hackernews:  true,
      github:      true,
      devto:       true,
    });
  });

  test("cache reports all four cache keys", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body.cache).toHaveProperty("youtube");
    expect(res.body.cache).toHaveProperty("hn");
    expect(res.body.cache).toHaveProperty("github");
    expect(res.body.cache).toHaveProperty("devto");
    expect(res.body.cache).toHaveProperty("keys");
  });

  test("returns 503 when YouTube key is placeholder", async () => {
    process.env.YOUTUBE_API_KEY = "your_youtube_api_key_here";
    jest.resetModules();
    const a = require("../server");
    const res = await request(a).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.config.youtube).toBe(false);
    process.env.YOUTUBE_API_KEY = "test-youtube-key-12345";
  });
});

// ─── GET /api/youtube ─────────────────────────────────────────────────────────

describe("GET /api/youtube", () => {
  let app, cache;
  beforeEach(() => {
    jest.resetModules();
    app   = require("../server");
    cache = require("../src/cacheManager");
    cache.flushAll();
    nock.cleanAll();
  });
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

  test("returns 200 with structured category data on success", async () => {
    mockYouTubeSuccess();
    const res = await request(app).get("/api/youtube");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("All");
    expect(Array.isArray(res.body.data.All)).toBe(true);
    expect(res.body.source).toBe("live");
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
    expect(video.url).toMatch(/youtube\.com\/watch/);
  });

  test("serves from cache on second request", async () => {
    mockYouTubeSuccess();
    await request(app).get("/api/youtube");
    const res = await request(app).get("/api/youtube");
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("cache");
    expect(res.body.isStale).toBe(false);
  });

  test("returns 502 on YouTube quota error", async () => {
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .reply(403, { error: { message: "quotaExceeded" } });
    const res = await request(app).get("/api/youtube");
    expect(res.status).toBe(502);
  });
});

// ─── GET /api/hackernews ──────────────────────────────────────────────────────

describe("GET /api/hackernews", () => {
  let app, cache;
  beforeEach(() => {
    jest.resetModules();
    app   = require("../server");
    cache = require("../src/cacheManager");
    cache.flushAll();
    nock.cleanAll();
  });
  afterEach(() => { nock.cleanAll(); cache.flushAll(); });

  test("returns 200 with array of stories on success", async () => {
    mockHNSuccess();
    const res = await request(app).get("/api/hackernews");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.source).toBe("live");
  });

  test("story has correct shape", async () => {
    mockHNSuccess();
    const res = await request(app).get("/api/hackernews");
    const story = res.body.data[0];
    expect(story).toHaveProperty("id");
    expect(story).toHaveProperty("title");
    expect(story).toHaveProperty("url");
    expect(story).toHaveProperty("score");
    expect(story).toHaveProperty("by");
    expect(story).toHaveProperty("rank");
    expect(story).toHaveProperty("commentsUrl");
    expect(story).toHaveProperty("domain");
  });

  test("returns up to 15 stories", async () => {
    mockHNSuccess();
    const res = await request(app).get("/api/hackernews");
    expect(res.body.data.length).toBeLessThanOrEqual(15);
  });

  test("serves from cache on second request", async () => {
    mockHNSuccess();
    await request(app).get("/api/hackernews");
    const res = await request(app).get("/api/hackernews");
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("cache");
  });

  test("returns 500 when HN API is down", async () => {
    nock(HN_BASE).get("/v0/topstories.json").replyWithError("Network error");
    const res = await request(app).get("/api/hackernews");
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/github ─────────────────────────────────────────────────────────

describe("GET /api/github", () => {
  let app, cache;
  beforeEach(() => {
    jest.resetModules();
    app   = require("../server");
    cache = require("../src/cacheManager");
    cache.flushAll();
    nock.cleanAll();
  });
  afterEach(() => { nock.cleanAll(); cache.flushAll(); });

  test("returns 200 with array of repos on success", async () => {
    mockGitHubSuccess();
    const res = await request(app).get("/api/github");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.source).toBe("live");
  });

  test("serves from cache on second request", async () => {
    mockGitHubSuccess();
    await request(app).get("/api/github");
    const res = await request(app).get("/api/github");
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("cache");
  });

  test("returns 500 when GitHub is unreachable", async () => {
    nock(GH_BASE).get("/trending").query(true).replyWithError("Network error");
    const res = await request(app).get("/api/github");
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/devto ───────────────────────────────────────────────────────────

describe("GET /api/devto", () => {
  let app, cache;
  beforeEach(() => {
    jest.resetModules();
    app   = require("../server");
    cache = require("../src/cacheManager");
    cache.flushAll();
    nock.cleanAll();
  });
  afterEach(() => { nock.cleanAll(); cache.flushAll(); });

  test("returns 200 with array of articles on success", async () => {
    mockDevToSuccess();
    const res = await request(app).get("/api/devto");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.source).toBe("live");
  });

  test("article has correct shape", async () => {
    mockDevToSuccess();
    const res = await request(app).get("/api/devto");
    const article = res.body.data[0];
    expect(article).toHaveProperty("id");
    expect(article).toHaveProperty("title");
    expect(article).toHaveProperty("url");
    expect(article).toHaveProperty("reactions");
    expect(article).toHaveProperty("comments");
    expect(article).toHaveProperty("rank");
    expect(article).toHaveProperty("author");
    expect(article.author).toHaveProperty("name");
  });

  test("returns up to 15 articles", async () => {
    mockDevToSuccess();
    const res = await request(app).get("/api/devto");
    expect(res.body.data.length).toBeLessThanOrEqual(15);
  });

  test("serves from cache on second request", async () => {
    mockDevToSuccess();
    await request(app).get("/api/devto");
    const res = await request(app).get("/api/devto");
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("cache");
  });

  test("returns 500 when Dev.to API is down", async () => {
    nock(DT_BASE).get("/api/articles").query(true).replyWithError("Network error");
    const res = await request(app).get("/api/devto");
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/refresh ─────────────────────────────────────────────────────────

describe("GET /api/refresh", () => {
  let app, cache;
  beforeEach(() => {
    jest.resetModules();
    app   = require("../server");
    cache = require("../src/cacheManager");
    cache.flushAll();
    nock.cleanAll();
  });
  afterEach(() => { nock.cleanAll(); cache.flushAll(); });

  test("returns 200 with confirmation message", async () => {
    const res = await request(app).get("/api/refresh");
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/cleared/i);
    expect(res.body).toHaveProperty("timestamp");
  });

  test("clears all four source caches", async () => {
    // Seed all four caches
    cache.set("youtube_trending", { All: [] });
    cache.set("hn_trending",      [{ id: 1 }]);
    cache.set("github_trending",  [{ fullName: "a/b" }]);
    cache.set("devto_trending",   [{ id: 99 }]);

    await request(app).get("/api/refresh");

    expect(cache.get("youtube_trending").data).toBeNull();
    expect(cache.get("hn_trending").data).toBeNull();
    expect(cache.get("github_trending").data).toBeNull();
    expect(cache.get("devto_trending").data).toBeNull();
  });
});

// ─── GET /api/cache-status ────────────────────────────────────────────────────

describe("GET /api/cache-status", () => {
  let app, cache;
  beforeEach(() => {
    jest.resetModules();
    app   = require("../server");
    cache = require("../src/cacheManager");
    cache.flushAll();
    nock.cleanAll();
  });
  afterEach(() => { nock.cleanAll(); cache.flushAll(); });

  test("returns status for all four sources when empty", async () => {
    const res = await request(app).get("/api/cache-status");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("youtube");
    expect(res.body).toHaveProperty("hn");
    expect(res.body).toHaveProperty("github");
    expect(res.body).toHaveProperty("devto");
  });

  test("shows zero secondsLeft when cache is empty", async () => {
    const res = await request(app).get("/api/cache-status");
    expect(res.body.youtube.secondsLeft).toBe(0);
    expect(res.body.hn.secondsLeft).toBe(0);
    expect(res.body.github.secondsLeft).toBe(0);
    expect(res.body.devto.secondsLeft).toBe(0);
  });

  test("shows positive secondsLeft after data is cached", async () => {
    cache.set("youtube_trending", { All: [] });
    cache.set("hn_trending",      []);
    const res = await request(app).get("/api/cache-status");
    expect(res.body.youtube.secondsLeft).toBeGreaterThan(0);
    expect(res.body.hn.secondsLeft).toBeGreaterThan(0);
    expect(res.body.youtube.cachedUntil).not.toBeNull();
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

  test("returns 404 for unsupported HTTP method on health", async () => {
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
