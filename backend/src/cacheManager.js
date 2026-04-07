const NodeCache = require("node-cache");
const logger = require("./logger");

const CACHE_TTL     = 1800; // 30 minutes (seconds)
const STALE_TTL     = 3600; // 60 minutes — serve stale data if API is down
const cache         = new NodeCache({ stdTTL: CACHE_TTL, useClones: false });
const staleCache    = new NodeCache({ stdTTL: STALE_TTL, useClones: false });

/**
 * Gets data from cache. Returns { data, isStale }.
 * Tries fresh cache first, falls back to stale cache.
 */
function get(key) {
  const fresh = cache.get(key);
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
 * Sets data in both fresh and stale caches.
 */
function set(key, value) {
  cache.set(key, value);
  staleCache.set(key, value);
  logger.info(`Cache: stored data for key "${key}"`);
}

/**
 * Returns TTL info for a key.
 */
function getTtl(key) {
  const ttl = cache.getTtl(key);
  if (!ttl) return null;
  return {
    expiresAt: new Date(ttl).toISOString(),
    secondsLeft: Math.max(0, Math.round((ttl - Date.now()) / 1000)),
  };
}

/**
 * Flushes only the fresh cache (stale remains as fallback).
 */
function flush() {
  cache.flushAll();
  logger.info("Cache: fresh cache flushed");
}

/**
 * Flushes everything including stale.
 */
function flushAll() {
  cache.flushAll();
  staleCache.flushAll();
  logger.info("Cache: all caches flushed");
}

function keys() {
  return cache.keys();
}

module.exports = { get, set, getTtl, flush, flushAll, keys };
