import { postgresFixedWindowStore } from "@/server/security/postgres-fixed-window-store";
import { pingRedis, redisFixedWindowStore } from "@/server/security/redis-fixed-window-store";
import type { FixedWindowRateLimitStore } from "@/server/security/rate-limit-types";

let cached: FixedWindowRateLimitStore | null = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

export async function getFixedWindowRateLimitStore(): Promise<FixedWindowRateLimitStore> {
  const force = process.env.FINTWIN_RATE_LIMIT_BACKEND?.trim();
  if (force === "postgres") return postgresFixedWindowStore;

  const now = Date.now();
  if (cached && now - cachedAt < CACHE_MS) return cached;

  const redisUrl = process.env.FINTWIN_REDIS_URL?.trim();
  if (force === "redis" || (redisUrl && (await pingRedis()))) {
    cached = redisFixedWindowStore;
  } else {
    cached = postgresFixedWindowStore;
  }
  cachedAt = now;
  return cached;
}

export function resetRateLimitBackendCacheForTests() {
  cached = null;
  cachedAt = 0;
}
