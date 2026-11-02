import "server-only";

import { log } from "@/lib/observability/logger";
import { pingRedis } from "@/server/security/redis-fixed-window-store";

const KEY_PREFIX = "fintwin:cache:";

let redis: import("ioredis").default | null = null;

async function getRedisClient(): Promise<import("ioredis").default | null> {
  const url = process.env.FINTWIN_REDIS_URL?.trim();
  if (!url) return null;
  if (!(await pingRedis())) return null;
  if (!redis) {
    const Redis = (await import("ioredis")).default;
    redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  }
  if (redis.status !== "ready") {
    try {
      await redis.connect();
    } catch {
      return null;
    }
  }
  return redis;
}

export function workspaceCacheKey(workspaceId: string, segment: string, params?: string) {
  const suffix = params ? `:${params}` : "";
  return `${KEY_PREFIX}ws:${workspaceId}:${segment}${suffix}`;
}

export async function invalidateWorkspaceReadCache(workspaceId: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  const pattern = `${KEY_PREFIX}ws:${workspaceId}:*`;
  let cursor = "0";
  do {
    const [next, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 64);
    cursor = next;
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } while (cursor !== "0");
}

export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const client = await getRedisClient();
  if (!client) {
    return loader();
  }

  try {
    const cached = await client.get(key);
    if (cached != null) {
      if (process.env.NODE_ENV === "development") {
        log.info("cache.hit", { meta: { key } });
      }
      return JSON.parse(cached) as T;
    }
  } catch {
    return loader();
  }

  const value = await loader();
  try {
    await client.set(key, JSON.stringify(value), "EX", Math.max(1, ttlSeconds));
  } catch {
    // degradação graciosa
  }
  return value;
}
