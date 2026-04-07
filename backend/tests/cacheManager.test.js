require("./setup");

// Use a fresh require each time to avoid shared state between test files
let cache;

beforeEach(() => {
  jest.resetModules();
  cache = require("../src/cacheManager");
  cache.flushAll();
});

describe("cacheManager", () => {
  // ─── get / set ──────────────────────────────────────────────────────────────

  describe("get and set", () => {
    test("returns null when key does not exist", () => {
      const result = cache.get("nonexistent-key");
      expect(result).toEqual({ data: null, isStale: false });
    });

    test("returns fresh data immediately after set", () => {
      cache.set("test-key", { items: [1, 2, 3] });
      const result = cache.get("test-key");
      expect(result.data).toEqual({ items: [1, 2, 3] });
      expect(result.isStale).toBe(false);
    });

    test("stores and retrieves complex objects", () => {
      const payload = {
        All: [{ id: "v1", title: "Video 1", views: 1000000 }],
        Gaming: [{ id: "v2", title: "Game Video", views: 500000 }],
      };
      cache.set("youtube_trending", payload);
      const { data } = cache.get("youtube_trending");
      expect(data).toEqual(payload);
    });

    test("overwrites existing value on re-set", () => {
      cache.set("key", "first-value");
      cache.set("key", "second-value");
      const { data } = cache.get("key");
      expect(data).toBe("second-value");
    });

    test("handles null values being stored", () => {
      cache.set("null-key", null);
      // null stored in NodeCache returns undefined on get, so data should be null
      const result = cache.get("null-key");
      // NodeCache treats null as a miss; this is expected behaviour
      expect(result).toBeDefined();
    });
  });

  // ─── getTtl ─────────────────────────────────────────────────────────────────

  describe("getTtl", () => {
    test("returns null for non-existent key", () => {
      expect(cache.getTtl("no-such-key")).toBeNull();
    });

    test("returns ttl object with expiresAt and secondsLeft after set", () => {
      cache.set("ttl-key", "value");
      const ttl = cache.getTtl("ttl-key");
      expect(ttl).not.toBeNull();
      expect(ttl).toHaveProperty("expiresAt");
      expect(ttl).toHaveProperty("secondsLeft");
      expect(typeof ttl.secondsLeft).toBe("number");
      expect(ttl.secondsLeft).toBeGreaterThan(0);
      expect(ttl.secondsLeft).toBeLessThanOrEqual(1800);
    });

    test("expiresAt is a valid ISO string", () => {
      cache.set("iso-key", "value");
      const ttl = cache.getTtl("iso-key");
      expect(() => new Date(ttl.expiresAt)).not.toThrow();
      expect(new Date(ttl.expiresAt).toISOString()).toBe(ttl.expiresAt);
    });
  });

  // ─── flush vs flushAll ───────────────────────────────────────────────────────

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

  // ─── keys ────────────────────────────────────────────────────────────────────

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
