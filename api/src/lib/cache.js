import redis from "./redis.js";

// ─── TTL Constants (seconds) ─────────────────────────────────────

export const TTL = {
  API_KEY: 300,        // 5 minutes  — hot-path auth lookup
  GEOGRAPHY: 3600,     // 1 hour     — states/districts/sub-districts
  VILLAGE: 1800,       // 30 minutes — village search results
  USAGE: 60,           // 1 minute   — usage counters
};

// ─── Key Namespace ──────────────────────────────────────────────

const ns = (scope, id) => `villageapi:${scope}:${id}`;

// ─── Cache Helpers ──────────────────────────────────────────────

/**
 * Retrieve a cached value by scope + id.
 * Returns parsed JSON or null if the key does not exist.
 */
export async function cacheGet(scope, id) {
  try {
    const raw = await redis.get(ns(scope, id));
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

/**
 * Store a value in cache with a TTL.
 * @param {string}  scope  — logical namespace (e.g. "apikey", "states")
 * @param {string}  id     — unique identifier within the scope
 * @param {*}       value  — serialisable value
 * @param {number}  ttl    — time-to-live in seconds (defaults to GEOGRAPHY)
 */
export async function cacheSet(scope, id, value, ttl = TTL.GEOGRAPHY) {
  try {
    const serialised = typeof value === "string" ? value : JSON.stringify(value);
    await redis.set(ns(scope, id), serialised, "EX", ttl);
  } catch {
    // no-op: serve uncached data when Redis is unavailable
  }
}

/**
 * Delete a cached key.
 */
export async function cacheDel(scope, id) {
  try {
    await redis.del(ns(scope, id));
  } catch {
    // no-op
  }
}

/**
 * Delete all keys matching a scope pattern.
 * Uses SCAN to avoid blocking the server.
 */
export async function cacheFlushScope(scope) {
  try {
    const pattern = `villageapi:${scope}:*`;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    // no-op
  }
}
