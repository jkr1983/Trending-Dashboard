require("./setup");
const nock = require("nock");
const { fetchTopStories, normalizeStory } = require("../src/hackerNewsService");

const HN_BASE = "https://hacker-news.firebaseio.com";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeHNItem(overrides = {}) {
  return {
    id: 42,
    type: "story",
    title: "Test HN Story",
    url: "https://example.com/article",
    score: 350,
    by: "testuser",
    descendants: 42,
    time: Math.floor(Date.now() / 1000) - 7200,
    ...overrides,
  };
}

function mockHNSuccess(count = 15) {
  const ids = Array.from({ length: count }, (_, i) => i + 1);
  nock(HN_BASE).get("/v0/topstories.json").reply(200, ids);
  ids.forEach((id) => {
    nock(HN_BASE)
      .get(`/v0/item/${id}.json`)
      .reply(200, makeHNItem({ id, title: `Story ${id}`, score: 100 + id }));
  });
}

// ─── normalizeStory ───────────────────────────────────────────────────────────

describe("normalizeStory", () => {
  test("maps all fields correctly", () => {
    const result = normalizeStory(makeHNItem(), 1);
    expect(result).toMatchObject({
      id:          42,
      rank:        1,
      title:       "Test HN Story",
      url:         "https://example.com/article",
      score:       350,
      by:          "testuser",
      descendants: 42,
    });
  });

  test("sets commentsUrl to HN item page", () => {
    const result = normalizeStory(makeHNItem({ id: 99 }), 1);
    expect(result.commentsUrl).toBe("https://news.ycombinator.com/item?id=99");
  });

  test("falls back to HN item URL when url is missing", () => {
    const item = makeHNItem({ id: 55 });
    delete item.url;
    const result = normalizeStory(item, 1);
    expect(result.url).toBe("https://news.ycombinator.com/item?id=55");
  });

  test("extracts domain from URL", () => {
    const result = normalizeStory(makeHNItem({ url: "https://www.example.com/path" }), 1);
    expect(result.domain).toBe("example.com");
  });

  test("sets domain to news.ycombinator.com when no url", () => {
    const item = makeHNItem();
    delete item.url;
    const result = normalizeStory(item, 1);
    expect(result.domain).toBe("news.ycombinator.com");
  });

  test("converts unix timestamp to ISO string", () => {
    const unixTime = 1700000000;
    const result = normalizeStory(makeHNItem({ time: unixTime }), 1);
    expect(result.time).toBe(new Date(unixTime * 1000).toISOString());
  });

  test("defaults score and descendants to 0 when missing", () => {
    const item = makeHNItem();
    delete item.score;
    delete item.descendants;
    const result = normalizeStory(item, 1);
    expect(result.score).toBe(0);
    expect(result.descendants).toBe(0);
  });

  test("returns null for null input", () => {
    expect(normalizeStory(null, 1)).toBeNull();
  });

  test("returns null for item without id", () => {
    const item = makeHNItem();
    delete item.id;
    expect(normalizeStory(item, 1)).toBeNull();
  });

  test("returns null for non-story type", () => {
    expect(normalizeStory(makeHNItem({ type: "comment" }), 1)).toBeNull();
    expect(normalizeStory(makeHNItem({ type: "job" }), 1)).toBeNull();
  });
});

// ─── fetchTopStories ──────────────────────────────────────────────────────────

describe("fetchTopStories", () => {
  afterEach(() => nock.cleanAll());

  test("returns up to 15 stories", async () => {
    mockHNSuccess(15);
    const stories = await fetchTopStories();
    expect(stories.length).toBeLessThanOrEqual(15);
    expect(stories.length).toBeGreaterThan(0);
  });

  test("fetches only the top 15 IDs even when more are available", async () => {
    // Provide 30 IDs but only first 15 should be fetched
    const ids = Array.from({ length: 30 }, (_, i) => i + 1);
    nock(HN_BASE).get("/v0/topstories.json").reply(200, ids);
    // Only mock items 1–15; if 16–30 are fetched the test will fail
    for (let i = 1; i <= 15; i++) {
      nock(HN_BASE)
        .get(`/v0/item/${i}.json`)
        .reply(200, makeHNItem({ id: i, title: `Story ${i}` }));
    }
    const stories = await fetchTopStories();
    expect(stories.length).toBeLessThanOrEqual(15);
  });

  test("story objects have correct shape", async () => {
    mockHNSuccess(3);
    const stories = await fetchTopStories();
    const story = stories[0];
    expect(story).toHaveProperty("id");
    expect(story).toHaveProperty("rank");
    expect(story).toHaveProperty("title");
    expect(story).toHaveProperty("url");
    expect(story).toHaveProperty("score");
    expect(story).toHaveProperty("by");
    expect(story).toHaveProperty("descendants");
    expect(story).toHaveProperty("commentsUrl");
    expect(story).toHaveProperty("domain");
    expect(story).toHaveProperty("time");
  });

  test("rank starts at 1 and increments", async () => {
    mockHNSuccess(5);
    const stories = await fetchTopStories();
    stories.forEach((s, i) => {
      expect(s.rank).toBe(i + 1);
    });
  });

  test("returns empty array when topstories returns empty list", async () => {
    nock(HN_BASE).get("/v0/topstories.json").reply(200, []);
    const stories = await fetchTopStories();
    expect(stories).toEqual([]);
  });

  test("skips items that fail to fetch without throwing", async () => {
    const ids = [1, 2, 3];
    nock(HN_BASE).get("/v0/topstories.json").reply(200, ids);
    nock(HN_BASE).get("/v0/item/1.json").reply(200, makeHNItem({ id: 1 }));
    nock(HN_BASE).get("/v0/item/2.json").replyWithError("timeout");
    nock(HN_BASE).get("/v0/item/3.json").reply(200, makeHNItem({ id: 3 }));

    const stories = await fetchTopStories();
    expect(stories.length).toBe(2);
    expect(stories.map((s) => s.id)).not.toContain(2);
  });

  test("throws when topstories endpoint is unreachable", async () => {
    nock(HN_BASE).get("/v0/topstories.json").replyWithError("Network failure");
    await expect(fetchTopStories()).rejects.toThrow();
  });
});
