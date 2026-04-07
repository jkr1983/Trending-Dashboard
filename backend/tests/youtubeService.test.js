require("./setup");
const nock = require("nock");
const { fetchAllCategories, normalizeVideo, validateApiKey, YT_CATEGORIES } = require("../src/youtubeService");

const YT_BASE = "https://www.googleapis.com";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeYtItem(overrides = {}) {
  return {
    id: "abc123",
    snippet: {
      title: "Test Video Title",
      channelTitle: "Test Channel",
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      description: "A test video description that is quite long and should be truncated properly.",
      thumbnails: {
        high:    { url: "https://img.youtube.com/vi/abc123/hqdefault.jpg" },
        default: { url: "https://img.youtube.com/vi/abc123/default.jpg" },
      },
    },
    statistics: {
      viewCount: "1500000",
      likeCount: "45000",
    },
    ...overrides,
  };
}

function makeSearchResponse(videoIds = ["abc123"]) {
  return { items: videoIds.map((id) => ({ id: { videoId: id } })) };
}

function makeVideosResponse(items = [makeYtItem()]) {
  return { items };
}

const CAT_COUNT = Object.keys(YT_CATEGORIES).length; // 11

// ─── validateApiKey ───────────────────────────────────────────────────────────

describe("validateApiKey", () => {
  test("does not throw for a valid key", () => {
    expect(() => validateApiKey("AIzaSyValidKey123")).not.toThrow();
  });
  test("throws for undefined", () => {
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

// ─── normalizeVideo ───────────────────────────────────────────────────────────

describe("normalizeVideo", () => {
  test("maps all fields correctly from a full item", () => {
    const result = normalizeVideo(makeYtItem());
    expect(result).toMatchObject({
      id:      "abc123",
      title:   "Test Video Title",
      channel: "Test Channel",
      url:     "https://www.youtube.com/watch?v=abc123",
      views:   1500000,
      likes:   45000,
    });
  });

  test("truncates description to 120 chars + ellipsis", () => {
    const longDesc = "A".repeat(200);
    const item = makeYtItem({ snippet: { ...makeYtItem().snippet, description: longDesc } });
    const result = normalizeVideo(item);
    expect(result.description.length).toBeLessThanOrEqual(124); // 120 + "…"
    expect(result.description).toMatch(/…$/);
  });

  test("falls back to medium then default thumbnail", () => {
    const item = makeYtItem();
    delete item.snippet.thumbnails.high;
    item.snippet.thumbnails.medium = { url: "https://img.youtube.com/medium.jpg" };
    expect(normalizeVideo(item).thumbnail).toBe("https://img.youtube.com/medium.jpg");
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

// ─── fetchAllCategories — two-pass 24h flow ───────────────────────────────────

describe("fetchAllCategories — two-pass 24h fetch", () => {
  afterEach(() => nock.cleanAll());

  test("throws when API key is invalid", async () => {
    await expect(fetchAllCategories("")).rejects.toThrow("missing or invalid");
  });

  test("uses search.list pass then videos.list pass per category", async () => {
    // Pass 1: search returns ≥5 IDs → Pass 2: videos.list fetches details
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(["v1","v2","v3","v4","v5","v6","v7","v8","v9","v10"]));
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, makeVideosResponse([makeYtItem()]));

    const result = await fetchAllCategories("valid-key");
    expect(Object.keys(result)).toHaveLength(CAT_COUNT);
    expect(result).toHaveProperty("All");
    expect(Array.isArray(result.All)).toBe(true);
    expect(result.All.length).toBe(1);
  });

  test("falls back to mostPopular chart when search returns fewer than 5 results", async () => {
    // Pass 1: search returns only 2 IDs → triggers fallback
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(["v1", "v2"]));
    // Fallback: videos.list with chart=mostPopular
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, makeVideosResponse([makeYtItem(), makeYtItem({ id: "xyz999" })]));

    const result = await fetchAllCategories("valid-key");
    expect(Object.keys(result)).toHaveLength(CAT_COUNT);
    // Both fallback videos should be present
    expect(result.All.length).toBe(2);
  });

  test("returns up to MAX_RESULTS (15) videos per category", async () => {
    const fifteenItems = Array.from({ length: 15 }, (_, i) =>
      makeYtItem({ id: `vid${i}`, statistics: { viewCount: String((15 - i) * 100000), likeCount: "1000" } })
    );
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(fifteenItems.map((v) => v.id)));
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, makeVideosResponse(fifteenItems));

    const result = await fetchAllCategories("valid-key");
    // Each category should have ≤ 15 videos
    Object.values(result).forEach((videos) => {
      expect(videos.length).toBeLessThanOrEqual(15);
    });
  });

  test("sorts results by viewCount descending after videos.list pass", async () => {
    const items = [
      makeYtItem({ id: "low",  statistics: { viewCount: "100",    likeCount: "1" } }),
      makeYtItem({ id: "high", statistics: { viewCount: "5000000", likeCount: "1" } }),
      makeYtItem({ id: "mid",  statistics: { viewCount: "250000",  likeCount: "1" } }),
    ];
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(["low", "high", "mid"]));
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, makeVideosResponse(items));

    const result = await fetchAllCategories("valid-key");
    const views = result.All.map((v) => v.views);
    expect(views[0]).toBeGreaterThanOrEqual(views[1]);
    expect(views[1]).toBeGreaterThanOrEqual(views[2]);
  });

  test("returns empty array for a category when both passes fail (not throwing)", async () => {
    // All searches succeed for 10 categories, one fails hard
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT - 1)
      .reply(200, makeSearchResponse(["v1","v2","v3","v4","v5"]));
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .once()
      .reply(500, { error: { message: "Internal Server Error" } });
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT - 1)
      .reply(200, makeVideosResponse());

    const result = await fetchAllCategories("valid-key");
    // All keys still present; failed category returns []
    expect(Object.keys(result)).toHaveLength(CAT_COUNT);
  });

  test("throws on 403 quota exceeded in search pass", async () => {
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .reply(403, { error: { message: "quotaExceeded" } });

    await expect(fetchAllCategories("valid-key")).rejects.toThrow("403");
  });

  test("handles empty items array in videos.list response", async () => {
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(["v1","v2","v3","v4","v5"]));
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, { items: [] });

    const result = await fetchAllCategories("valid-key");
    Object.values(result).forEach((videos) => {
      expect(videos).toEqual([]);
    });
  });

  test("publishedAfter param is included in search request", async () => {
    let capturedQuery = null;
    nock(YT_BASE)
      .get("/youtube/v3/search")
      .query((q) => { capturedQuery = q; return true; })
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(["v1","v2","v3","v4","v5"]));
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, makeVideosResponse());

    await fetchAllCategories("valid-key");

    expect(capturedQuery).toHaveProperty("publishedAfter");
    // publishedAfter should be within the last ~25 hours
    const cutoff = new Date(capturedQuery.publishedAfter).getTime();
    expect(Date.now() - cutoff).toBeLessThan(25 * 60 * 60 * 1000);
    expect(Date.now() - cutoff).toBeGreaterThan(23 * 60 * 60 * 1000);
  });
});
