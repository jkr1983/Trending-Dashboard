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
      publishedAt: "2024-01-15T10:00:00Z",
      description: "A test video description that is quite long and should be truncated properly.",
      thumbnails: {
        high: { url: "https://img.youtube.com/vi/abc123/hqdefault.jpg" },
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

function makeYtResponse(items = [makeYtItem()]) {
  return { items };
}

// ─── validateApiKey ───────────────────────────────────────────────────────────

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

// ─── normalizeVideo ───────────────────────────────────────────────────────────

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
    expect(result.description.length).toBeLessThanOrEqual(124); // 120 + "…"
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
    const result = normalizeVideo(item);
    expect(result.thumbnail).toBeNull();
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
    const result = normalizeVideo(item);
    expect(result.title).toBe("Untitled");
  });
});

// ─── fetchAllCategories ───────────────────────────────────────────────────────

describe("fetchAllCategories (YouTube)", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  test("throws when API key is invalid", async () => {
    await expect(fetchAllCategories("")).rejects.toThrow("missing or invalid");
  });

  test("returns all category keys on success", async () => {
    const categoryCount = Object.keys(YT_CATEGORIES).length;

    // Mock all category requests
    nock(YT_BASE)
      .get("/youtube/v3/videos")
      .query(true)
      .times(categoryCount)
      .reply(200, makeYtResponse());

    const result = await fetchAllCategories("valid-key");
    expect(Object.keys(result)).toHaveLength(categoryCount);
    expect(result).toHaveProperty("All");
    expect(result).toHaveProperty("Gaming");
    expect(result).toHaveProperty("Music");
  });

  test("returns empty array for a category when API call fails, not throwing", async () => {
    const categoryCount = Object.keys(YT_CATEGORIES).length;

    nock(YT_BASE)
      .get("/youtube/v3/videos")
      .query(true)
      .times(categoryCount - 1)
      .reply(200, makeYtResponse())
      .get("/youtube/v3/videos")
      .query(true)
      .once()
      .reply(500, { error: { message: "Internal Server Error" } });

    const result = await fetchAllCategories("valid-key");
    // All categories should still be present; one might be []
    expect(Object.keys(result).length).toBe(categoryCount);
  });

  test("throws on 403 quota exceeded", async () => {
    nock(YT_BASE)
      .get("/youtube/v3/videos")
      .query(true)
      .reply(403, { error: { message: "quotaExceeded" } });

    // At least one category will throw on 403
    await expect(fetchAllCategories("valid-key")).rejects.toThrow("403");
  });

  test("handles empty items array in response", async () => {
    const categoryCount = Object.keys(YT_CATEGORIES).length;

    nock(YT_BASE)
      .get("/youtube/v3/videos")
      .query(true)
      .times(categoryCount)
      .reply(200, { items: [] });

    const result = await fetchAllCategories("valid-key");
    Object.values(result).forEach((videos) => {
      expect(videos).toEqual([]);
    });
  });
});
