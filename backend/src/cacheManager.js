const NodeCache = require("node-cache");
const logger = require("./logger");

// Two-tier TTL: fresh data for 30 min, stale fallback for 60 min
const FRESH_TTL  = 30 * 60;  // 30 minutes in seconds
const STALE_TTL  = 60 * 60;  // 60 minutes in seconds

// Primary cache: stores fresh data
const freshCache = new NodeCache({ stdTTL: FRESH_TTL, checkperiod: 60 });

// Stale cache: stores last-known data longer as a fallback
const staleCache = new NodeCache({ stdTTL: STALE_TTL, checkperiod: 120 });

/**
 * Get data from cache.
 * Returns { data, isStale } — data may come from fresh or stale cache.
 */
function get(key) {
  const fresh = freshCache.get(key);
  if (fresh !== undefined) {
    return { data: fresh, isStale: false };
  }

  const stale = staleCache.get(key);
  if (stale !== undefined) {
    logger.warn(`Cache: serving stale data for key "${key}"`);
    return { data: stale, isStale: true };
  }

  return { data: null, isStale: false };
}

/**
 * Set data in both fresh and stale caches.
 */
function set(key, value) {
  freshCache.set(key, value);
  staleCache.set(key, value);
  logger.debug(`Cache: stored "${key}"`);
}

/**
 * Delete a key from both caches (used by /api/refresh).
 */
function del(key) {
  freshCache.del(key);
  logger.debug(`Cache: deleted fresh "${key}"`);
}

/**
 * Flush ALL keys from the fresh cache (keeps stale as fallback).
 */
function flush() {
  freshCache.flushAll();
  logger.info("Cache: fresh cache flushed");
}

/**
 * Flush ALL keys from BOTH caches (hard reset).
 */
function flushAll() {
  freshCache.flushAll();
  staleCache.flushAll();
  logger.info("Cache: all caches flushed");
}

/**
 * Get the TTL expiry timestamp (ms since epoch) for a key, or null if not cached.
 */
function getTtl(key) {
  const ttl = freshCache.getTtl(key);
  return ttl || null;
}

/**
 * List all keys currently in the fresh cache.
 */
function keys() {
  return freshCache.keys();
}

module.exports = { get, set, del, flush, flushAll, getTtl, keys };
