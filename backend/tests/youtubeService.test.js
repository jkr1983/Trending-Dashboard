require("./setup");
const nock = require("nock");
const {
  fetchAllCategories,
  normalizeVideo,
  isPlayable,
  isRecent,
  validateApiKey,
  YT_CATEGORIES,
  MAX_AGE_MS,
} = require("../src/youtubeService");

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
    status: {
      uploadStatus:  "processed",
      privacyStatus: "public",
      embeddable:    true,
    },
    contentDetails: {
      duration: "PT3M14S",
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

// ─── isPlayable ───────────────────────────────────────────────────────────────

describe("isPlayable", () => {
  test("accepts a normal public, processed video", () => {
    expect(isPlayable(makeYtItem())).toBe(true);
  });

  test("rejects null / missing id / missing snippet", () => {
    expect(isPlayable(null)).toBe(false);
    const noId = makeYtItem(); delete noId.id;
    expect(isPlayable(noId)).toBe(false);
    const noSnippet = makeYtItem(); delete noSnippet.snippet;
    expect(isPlayable(noSnippet)).toBe(false);
  });

  test("rejects videos with uploadStatus other than 'processed'", () => {
    for (const bad of ["deleted", "failed", "rejected", "uploaded"]) {
      const item = makeYtItem({ status: { uploadStatus: bad, privacyStatus: "public" } });
      expect(isPlayable(item)).toBe(false);
    }
  });

  test("rejects private videos", () => {
    const item = makeYtItem({ status: { uploadStatus: "processed", privacyStatus: "private" } });
    expect(isPlayable(item)).toBe(false);
  });

  test("rejects unlisted videos", () => {
    const item = makeYtItem({ status: { uploadStatus: "processed", privacyStatus: "unlisted" } });
    expect(isPlayable(item)).toBe(false);
  });

  test("rejects videos region-blocked in the US", () => {
    const item = makeYtItem({
      contentDetails: { duration: "PT1M", regionRestriction: { blocked: ["US", "CA"] } },
    });
    expect(isPlayable(item)).toBe(false);
  });

  test("accepts videos region-blocked outside the US", () => {
    const item = makeYtItem({
      contentDetails: { duration: "PT1M", regionRestriction: { blocked: ["DE", "FR"] } },
    });
    expect(isPlayable(item)).toBe(true);
  });

  test("rejects videos with an allow-list that excludes the US", () => {
    const item = makeYtItem({
      contentDetails: { duration: "PT1M", regionRestriction: { allowed: ["GB", "CA"] } },
    });
    expect(isPlayable(item)).toBe(false);
  });

  test("accepts videos with an allow-list that includes the US", () => {
    const item = makeYtItem({
      contentDetails: { duration: "PT1M", regionRestriction: { allowed: ["US", "CA"] } },
    });
    expect(isPlayable(item)).toBe(true);
  });

  test("accepts videos that don't provide status/contentDetails at all", () => {
    const item = makeYtItem();
    delete item.status;
    delete item.contentDetails;
    expect(isPlayable(item)).toBe(true);
  });

  test("rejects videos where statistics.viewCount key is missing (rights-gated)", () => {
    // Real-world case: ESPN broadcast kx7VwFiRPVk returned
    // `statistics: { favoriteCount: "0" }` with no viewCount key.
    // Data API reports it public/processed, but watch page returns
    // playabilityStatus ERROR "Video unavailable".
    const item = makeYtItem({ statistics: { favoriteCount: "0" } });
    expect(isPlayable(item)).toBe(false);
  });

  test("rejects videos with no statistics object at all", () => {
    const item = makeYtItem();
    delete item.statistics;
    expect(isPlayable(item)).toBe(false);
  });

  test("accepts videos with viewCount = '0' (legitimately fresh upload)", () => {
    // Key presence matters, not the value — a brand-new upload with zero
    // views still has the viewCount key, unlike rights-gated content.
    const item = makeYtItem({ statistics: { viewCount: "0", likeCount: "0", favoriteCount: "0" } });
    expect(isPlayable(item)).toBe(true);
  });
});

// ─── isRecent ─────────────────────────────────────────────────────────────────

function itemPublishedHoursAgo(hours, overrides = {}) {
  const publishedAt = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const item = makeYtItem(overrides);
  item.snippet.publishedAt = publishedAt;
  return item;
}

describe("isRecent", () => {
  test("MAX_AGE_MS is 21 days in ms (backend outer guardrail for the user's time-frame dropdown)", () => {
    expect(MAX_AGE_MS).toBe(21 * 24 * 60 * 60 * 1000);
  });

  test("accepts a video published 5h ago", () => {
    expect(isRecent(itemPublishedHoursAgo(5))).toBe(true);
  });

  test("accepts a video published 25h ago (inside the widest frontend dropdown option)", () => {
    expect(isRecent(itemPublishedHoursAgo(25))).toBe(true);
  });

  test("accepts a video published 10 days ago (inside the 10-day dropdown option)", () => {
    expect(isRecent(itemPublishedHoursAgo(10 * 24))).toBe(true);
  });

  test("accepts a video published 20 days ago (largest dropdown option)", () => {
    expect(isRecent(itemPublishedHoursAgo(20 * 24))).toBe(true);
  });

  test("accepts a video published at the 21-day boundary (MAX_AGE_MS)", () => {
    // At exactly 21d, (nowMs - ts) === MAX_AGE_MS → included by the `<=` check.
    const pa = new Date(Date.now() - MAX_AGE_MS).toISOString();
    const item = makeYtItem();
    item.snippet.publishedAt = pa;
    expect(isRecent(item)).toBe(true);
  });

  test("rejects a video published 22 days ago (just past the outer guardrail)", () => {
    expect(isRecent(itemPublishedHoursAgo(22 * 24))).toBe(false);
  });

  test("rejects a video published 60 days ago", () => {
    expect(isRecent(itemPublishedHoursAgo(60 * 24))).toBe(false);
  });

  test("rejects items with no publishedAt", () => {
    const item = makeYtItem();
    delete item.snippet.publishedAt;
    expect(isRecent(item)).toBe(false);
  });

  test("rejects items with unparseable publishedAt", () => {
    const item = makeYtItem();
    item.snippet.publishedAt = "not-a-date";
    expect(isRecent(item)).toBe(false);
  });

  test("rejects null/undefined input", () => {
    expect(isRecent(null)).toBe(false);
    expect(isRecent(undefined)).toBe(false);
    expect(isRecent({})).toBe(false);
  });

  test("honours the nowMs parameter for deterministic testing", () => {
    // Item published at a fixed timestamp
    const fixedPa = "2026-04-11T00:00:00.000Z";
    const item = makeYtItem();
    item.snippet.publishedAt = fixedPa;

    const ts = Date.parse(fixedPa);
    const DAY = 24 * 3600 * 1000;
    // now = ts + 10 days → recent
    expect(isRecent(item, ts + 10 * DAY)).toBe(true);
    // now = ts + 22 days → stale (past 21d guardrail)
    expect(isRecent(item, ts + 22 * DAY)).toBe(false);
    // now = ts + 21 days exactly → boundary accepted
    expect(isRecent(item, ts + 21 * DAY)).toBe(true);
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

  test("returns up to MAX_RESULTS (50) videos per category", async () => {
    const fiftyItems = Array.from({ length: 50 }, (_, i) =>
      makeYtItem({ id: `vid${i}`, statistics: { viewCount: String((50 - i) * 100000), likeCount: "1000" } })
    );
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(fiftyItems.map((v) => v.id)));
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, makeVideosResponse(fiftyItems));

    const result = await fetchAllCategories("valid-key");
    // Each category should have ≤ 50 videos (YouTube's single-call maximum)
    Object.values(result).forEach((videos) => {
      expect(videos.length).toBeLessThanOrEqual(50);
    });
    // Sanity: All should have all 50 since they're all playable + recent
    expect(result.All.length).toBe(50);
  });

  test("sorts results by viewCount descending after videos.list pass", async () => {
    // Must supply ≥5 IDs so fetchCategory takes the primary (sorting) path
    // rather than the mostPopular fallback.
    const items = [
      makeYtItem({ id: "low",     statistics: { viewCount: "100",     likeCount: "1" } }),
      makeYtItem({ id: "high",    statistics: { viewCount: "5000000", likeCount: "1" } }),
      makeYtItem({ id: "mid",     statistics: { viewCount: "250000",  likeCount: "1" } }),
      makeYtItem({ id: "lowish",  statistics: { viewCount: "900",     likeCount: "1" } }),
      makeYtItem({ id: "highish", statistics: { viewCount: "800000",  likeCount: "1" } }),
    ];
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(["low", "high", "mid", "lowish", "highish"]));
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, makeVideosResponse(items));

    const result = await fetchAllCategories("valid-key");
    const views = result.All.map((v) => v.views);
    expect(views).toEqual([5000000, 800000, 250000, 900, 100]);
    for (let i = 0; i < views.length - 1; i++) {
      expect(views[i]).toBeGreaterThanOrEqual(views[i + 1]);
    }
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

  test("filters out unplayable videos returned by videos.list", async () => {
    // search returns 5 IDs, videos.list returns 5 items but 3 are unplayable
    const items = [
      makeYtItem({ id: "ok1",     statistics: { viewCount: "500", likeCount: "1" } }),
      makeYtItem({ id: "private", status: { uploadStatus: "processed", privacyStatus: "private" } }),
      makeYtItem({ id: "deleted", status: { uploadStatus: "deleted",   privacyStatus: "public"  } }),
      makeYtItem({
        id: "regionblocked",
        contentDetails: { duration: "PT1M", regionRestriction: { blocked: ["US"] } },
      }),
      makeYtItem({ id: "ok2", statistics: { viewCount: "9000", likeCount: "1" } }),
    ];
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(["ok1", "private", "deleted", "regionblocked", "ok2"]));
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, makeVideosResponse(items));

    const result = await fetchAllCategories("valid-key");
    const ids = result.All.map((v) => v.id);
    expect(ids).toEqual(["ok2", "ok1"]); // sorted by views desc
    expect(ids).not.toContain("private");
    expect(ids).not.toContain("deleted");
    expect(ids).not.toContain("regionblocked");
  });

  test("filters out unplayable videos in mostPopular fallback path", async () => {
    // Force fallback by returning fewer than 5 search IDs
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(["v1", "v2"]));
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, makeVideosResponse([
        makeYtItem({ id: "keep" }),
        makeYtItem({ id: "drop", status: { uploadStatus: "processed", privacyStatus: "private" } }),
      ]));

    const result = await fetchAllCategories("valid-key");
    const ids = result.All.map((v) => v.id);
    expect(ids).toEqual(["keep"]);
  });

  test("drops out-of-window (>21d) videos on the primary path", async () => {
    // The backend's outer guardrail is 21 days. Anything older than that is
    // dropped before it reaches the frontend. (Finer-grained user filtering
    // happens client-side.) Mix recent + stale to prove only the recent ones
    // survive.
    const DAY = 24 * 3600 * 1000;
    const recent1 = makeYtItem({ id: "recent1", statistics: { viewCount: "5000",  likeCount: "1" } });
    recent1.snippet.publishedAt = new Date(Date.now() - 2 * 3600 * 1000).toISOString();     // 2h
    const recent2 = makeYtItem({ id: "recent2", statistics: { viewCount: "9000",  likeCount: "1" } });
    recent2.snippet.publishedAt = new Date(Date.now() - 15 * DAY).toISOString();            // 15 days
    const stale1  = makeYtItem({ id: "stale1",  statistics: { viewCount: "100000", likeCount: "1" } });
    stale1.snippet.publishedAt  = new Date(Date.now() - 30 * DAY).toISOString();            // 30 days
    const stale2  = makeYtItem({ id: "stale2",  statistics: { viewCount: "200000", likeCount: "1" } });
    stale2.snippet.publishedAt  = new Date(Date.now() - 180 * DAY).toISOString();           // 6 months
    const missing = makeYtItem({ id: "missing" });
    delete missing.snippet.publishedAt;

    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(["recent1", "recent2", "stale1", "stale2", "missing"]));
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, makeVideosResponse([recent1, recent2, stale1, stale2, missing]));

    const result = await fetchAllCategories("valid-key");
    const ids = result.All.map((v) => v.id);
    expect(ids.sort()).toEqual(["recent1", "recent2"]); // stale and missing dropped
    // Sanity: every returned video is within the 21-day guardrail
    for (const v of result.All) {
      const age = Date.now() - Date.parse(v.publishedAt);
      expect(age).toBeLessThanOrEqual(21 * DAY);
    }
  });

  test("drops out-of-window videos on the mostPopular fallback path", async () => {
    // Force fallback with <5 search IDs. Backend guardrail is 21 days now,
    // so the stale fixture must be older than that.
    const DAY = 24 * 3600 * 1000;
    const recent = makeYtItem({ id: "recentOne" });
    recent.snippet.publishedAt = new Date(Date.now() - 3 * 3600 * 1000).toISOString();  // 3h
    const stale  = makeYtItem({ id: "staleOne" });
    stale.snippet.publishedAt  = new Date(Date.now() - 25 * DAY).toISOString();         // 25 days

    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(["v1", "v2"]));
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, makeVideosResponse([recent, stale]));

    const result = await fetchAllCategories("valid-key");
    expect(result.All.map((v) => v.id)).toEqual(["recentOne"]);
  });

  test("returns empty category when every video is past the 21-day guardrail", async () => {
    // All items older than 21 days → backend returns empty. This protects
    // the frontend from ever receiving content it couldn't even select
    // via the widest dropdown (20 days).
    const DAY = 24 * 3600 * 1000;
    const items = Array.from({ length: 5 }, (_, i) => {
      const it = makeYtItem({ id: `old${i}`, statistics: { viewCount: String(10000 + i), likeCount: "1" } });
      it.snippet.publishedAt = new Date(Date.now() - (22 + i) * DAY).toISOString();
      return it;
    });
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(items.map((i) => i.id)));
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, makeVideosResponse(items));

    const result = await fetchAllCategories("valid-key");
    Object.values(result).forEach((vids) => expect(vids).toEqual([]));
  });

  test("implicitly drops videos that search returned but videos.list did not", async () => {
    // search returns 5 IDs but videos.list only returns 2 (3 deleted/unavailable)
    nock(YT_BASE)
      .get("/youtube/v3/search").query(true)
      .times(CAT_COUNT)
      .reply(200, makeSearchResponse(["a", "b", "c", "d", "e"]));
    nock(YT_BASE)
      .get("/youtube/v3/videos").query(true)
      .times(CAT_COUNT)
      .reply(200, makeVideosResponse([
        makeYtItem({ id: "a" }),
        makeYtItem({ id: "b" }),
      ]));

    const result = await fetchAllCategories("valid-key");
    expect(result.All.map((v) => v.id).sort()).toEqual(["a", "b"]);
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
    // publishedAfter should match MAX_AGE_MS (21 days), with a small slack
    // for the test-execution time between reading Date.now() and asserting.
    const cutoff = new Date(capturedQuery.publishedAfter).getTime();
    const age = Date.now() - cutoff;
    expect(age).toBeGreaterThanOrEqual(21 * 24 * 60 * 60 * 1000 - 1000); // −1s slack
    expect(age).toBeLessThan(21 * 24 * 60 * 60 * 1000 + 5000);           // +5s slack
  });
});
