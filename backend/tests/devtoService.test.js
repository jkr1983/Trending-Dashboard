require("./setup");
const nock = require("nock");
const { fetchTopArticles, normalizeArticle } = require("../src/devtoService");

const DT_BASE = "https://dev.to";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeArticle(overrides = {}) {
  return {
    id: 1001,
    title: "How to Build Amazing Things",
    url: "https://dev.to/author/how-to-build-amazing-things-abc1",
    description: "A short description of the article content.",
    cover_image: "https://dev.to/cover.jpg",
    social_image: null,
    tag_list: ["javascript", "webdev", "tutorial", "react"],
    public_reactions_count: 120,
    comments_count: 18,
    reading_time_minutes: 6,
    published_at: "2024-01-20T10:00:00Z",
    user: {
      name: "Jane Dev",
      username: "janedev",
      profile_image_90: "https://dev.to/janedev.jpg",
    },
    ...overrides,
  };
}

function mockDevToSuccess(count = 15) {
  const articles = Array.from({ length: count }, (_, i) =>
    makeArticle({ id: i + 1, title: `Article ${i + 1}` })
  );
  nock(DT_BASE)
    .get("/api/articles")
    .query(true)
    .reply(200, articles);
}

// ─── normalizeArticle ─────────────────────────────────────────────────────────

describe("normalizeArticle", () => {
  test("maps all fields correctly", () => {
    const result = normalizeArticle(makeArticle(), 1);
    expect(result).toMatchObject({
      id:          1001,
      rank:        1,
      title:       "How to Build Amazing Things",
      url:         "https://dev.to/author/how-to-build-amazing-things-abc1",
      reactions:   120,
      comments:    18,
      readingTime: 6,
    });
  });

  test("includes author details", () => {
    const result = normalizeArticle(makeArticle(), 1);
    expect(result.author).toMatchObject({
      name:     "Jane Dev",
      username: "janedev",
    });
    expect(result.author.avatar).toBe("https://dev.to/janedev.jpg");
  });

  test("limits tags to 4", () => {
    const item = makeArticle({ tag_list: ["a", "b", "c", "d", "e", "f"] });
    const result = normalizeArticle(item, 1);
    expect(result.tags.length).toBeLessThanOrEqual(4);
  });

  test("truncates description to 140 chars + ellipsis", () => {
    const longDesc = "X".repeat(200);
    const result = normalizeArticle(makeArticle({ description: longDesc }), 1);
    expect(result.description.length).toBeLessThanOrEqual(144); // 140 + "…"
    expect(result.description).toMatch(/…$/);
  });

  test("does not truncate short descriptions", () => {
    const result = normalizeArticle(makeArticle({ description: "Short." }), 1);
    expect(result.description).toBe("Short.");
  });

  test("uses cover_image when present", () => {
    const result = normalizeArticle(makeArticle(), 1);
    expect(result.coverImage).toBe("https://dev.to/cover.jpg");
  });

  test("falls back to social_image when cover_image is null", () => {
    const item = makeArticle({ cover_image: null, social_image: "https://dev.to/social.jpg" });
    const result = normalizeArticle(item, 1);
    expect(result.coverImage).toBe("https://dev.to/social.jpg");
  });

  test("coverImage is null when both images are absent", () => {
    const item = makeArticle({ cover_image: null, social_image: null });
    const result = normalizeArticle(item, 1);
    expect(result.coverImage).toBeNull();
  });

  test("defaults reactions and comments to 0 when missing", () => {
    const item = makeArticle({ public_reactions_count: undefined, comments_count: undefined });
    const result = normalizeArticle(item, 1);
    expect(result.reactions).toBe(0);
    expect(result.comments).toBe(0);
  });

  test("handles missing user gracefully", () => {
    const item = makeArticle({ user: undefined });
    const result = normalizeArticle(item, 1);
    expect(result.author.name).toBe("Unknown");
    expect(result.author.username).toBe("");
    expect(result.author.avatar).toBeNull();
  });

  test("returns null for null input", () => {
    expect(normalizeArticle(null, 1)).toBeNull();
  });

  test("returns null for item missing id", () => {
    const item = makeArticle();
    delete item.id;
    expect(normalizeArticle(item, 1)).toBeNull();
  });

  test("tags defaults to empty array when tag_list is not an array", () => {
    const result = normalizeArticle(makeArticle({ tag_list: null }), 1);
    expect(result.tags).toEqual([]);
  });
});

// ─── fetchTopArticles ─────────────────────────────────────────────────────────

describe("fetchTopArticles", () => {
  afterEach(() => nock.cleanAll());

  test("returns up to 15 articles", async () => {
    mockDevToSuccess(15);
    const articles = await fetchTopArticles();
    expect(articles.length).toBeLessThanOrEqual(15);
    expect(articles.length).toBeGreaterThan(0);
  });

  test("sends top=1 and per_page=15 params", async () => {
    let capturedQuery = null;
    nock(DT_BASE)
      .get("/api/articles")
      .query((q) => { capturedQuery = q; return true; })
      .reply(200, [makeArticle()]);

    await fetchTopArticles();
    expect(capturedQuery.top).toBe("1");
    expect(capturedQuery.per_page).toBe("15");
  });

  test("article objects have correct shape", async () => {
    mockDevToSuccess(3);
    const articles = await fetchTopArticles();
    const a = articles[0];
    expect(a).toHaveProperty("id");
    expect(a).toHaveProperty("rank");
    expect(a).toHaveProperty("title");
    expect(a).toHaveProperty("url");
    expect(a).toHaveProperty("reactions");
    expect(a).toHaveProperty("comments");
    expect(a).toHaveProperty("author");
    expect(a).toHaveProperty("tags");
    expect(a).toHaveProperty("publishedAt");
  });

  test("rank starts at 1 and increments", async () => {
    mockDevToSuccess(5);
    const articles = await fetchTopArticles();
    articles.forEach((a, i) => {
      expect(a.rank).toBe(i + 1);
    });
  });

  test("filters out null items (e.g. missing id)", async () => {
    nock(DT_BASE)
      .get("/api/articles")
      .query(true)
      .reply(200, [
        makeArticle({ id: 1 }),
        { title: "No ID article" }, // missing id → normalizeArticle returns null
        makeArticle({ id: 3 }),
      ]);
    const articles = await fetchTopArticles();
    expect(articles.length).toBe(2);
    expect(articles.map((a) => a.id)).toEqual([1, 3]);
  });

  test("returns empty array when API returns empty list", async () => {
    nock(DT_BASE).get("/api/articles").query(true).reply(200, []);
    const articles = await fetchTopArticles();
    expect(articles).toEqual([]);
  });

  test("throws when Dev.to API is unreachable", async () => {
    nock(DT_BASE).get("/api/articles").query(true).replyWithError("Connection refused");
    await expect(fetchTopArticles()).rejects.toThrow();
  });
});
