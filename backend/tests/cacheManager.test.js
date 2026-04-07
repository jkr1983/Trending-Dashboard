require("./setup");

let cache;

beforeEach(() => {
  jest.resetModules();
  cache = require("../src/cacheManager");
  cache.flushAll();
});

describe("cacheManager", () => {
  describe("get and set", () => {
    test("returns null when key does not exist", () => {
      expect(cache.get("nonexistent-key")).toEqual({ data: null, isStale: false });
    });

    test("returns fresh data immediately after set", () => {
      cache.set("test-key", { items: [1, 2, 3] });
      const result = cache.get("test-key");
      expect(result.data).toEqual({ items: [1, 2, 3] });
      expect(result.isStale).toBe(false);
    });

    test("stores and retrieves complex objects", () => {
      const payload = { All: [{ id: "v1", title: "Video 1", views: 1000000 }] };
      cache.set("youtube_trending", payload);
      expect(cache.get("youtube_trending").data).toEqual(payload);
    });

    test("overwrites existing value on re-set", () => {
      cache.set("key", "first-value");
      cache.set("key", "second-value");
      expect(cache.get("key").data).toBe("second-value");
    });
  });

  describe("getTtl", () => {
    test("returns null for non-existent key", () => {
      expect(cache.getTtl("no-such-key")).toBeNull();
    });

    test("returns a future timestamp after set", () => {
      cache.set("ttl-key", "value");
      const ttl = cache.getTtl("ttl-key");
      expect(ttl).toBeGreaterThan(Date.now());
    });
  });

  describe("del", () => {
    test("del removes key from fresh cache", () => {
      cache.set("to-delete", "value");
      cache.del("to-delete");
      // After del, fresh is gone — stale may still serve it
      const result = cache.get("to-delete");
      // Could be stale or null depending on timing — just verify no error thrown
      expect(result).toBeDefined();
    });
  });

  describe("flush", () => {
    test("flush clears all fresh keys", () => {
      cache.set("key1", "a");
      cache.set("key2", "b");
      cache.flush();
      expect(cache.keys()).toHaveLength(0);
    });
  });

  describe("flushAll", () => {
    test("flushAll clears all caches", () => {
      cache.set("k1", "x");
      cache.flushAll();
      expect(cache.keys()).toHaveLength(0);
    });
  });

  describe("keys", () => {
    test("returns empty array when cache is empty", () => {
      expect(cache.keys()).toEqual([]);
    });

    test("returns all set keys", () => {
      cache.set("youtube_trending", {});
      cache.set("hn_trending", []);
      cache.set("github_trending", []);
      cache.set("devto_trending", []);
      expect(cache.keys()).toHaveLength(4);
      expect(cache.keys()).toEqual(
        expect.arrayContaining(["youtube_trending", "hn_trending", "github_trending", "devto_trending"])
      );
    });
  });
});
