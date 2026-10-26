import Redis from "ioredis";
import type { FixedWindowRateLimitResult, FixedWindowRateLimitStore } from "@/server/security/rate-limit-types";

let client: Redis | null = null;

function redisClient(): Redis {
  if (!client) {
    const url = process.env.FINTWIN_REDIS_URL?.trim();
    if (!url) throw new Error("FINTWIN_REDIS_URL_MISSING");
    client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }
  return client;
}

export async function pingRedis(): Promise<boolean> {
  try {
    const redis = redisClient();
    if (redis.status !== "ready") await redis.connect();
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

export const redisFixedWindowStore: FixedWindowRateLimitStore = {
  backend: "redis",
  async consume(key, limit, windowMs) {
    const redis = redisClient();
    if (redis.status !== "ready") await redis.connect();

    const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    const redisKey = `fintwin:rl:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, ttlSeconds);
    }
    const ttl = await redis.ttl(redisKey);
    const retryAfterSeconds = ttl > 0 ? ttl : ttlSeconds;

    return {
      allowed: count <= limit,
      count,
      limit,
      retryAfterSeconds,
    } satisfies FixedWindowRateLimitResult;
  },
};
