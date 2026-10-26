import { db } from "@/lib/db";
import type { RateBucket } from "@/lib/auth/distributed-rate-limit";
import { pingRedis } from "@/server/security/redis-fixed-window-store";

const AUTH_BUCKET_PREFIX = "fintwin:auth:";

let redis: import("ioredis").default | null = null;

async function getRedis() {
  const url = process.env.FINTWIN_REDIS_URL?.trim();
  if (!url) return null;
  if (!(await pingRedis())) return null;
  if (!redis) {
    const Redis = (await import("ioredis")).default;
    redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  }
  if (redis.status !== "ready") await redis.connect();
  return redis;
}

function toBucket(row: {
  failures: number;
  subjects: unknown;
  windowStartedAt: Date;
  blockedUntil: Date | null;
} | null): RateBucket | undefined {
  if (!row) return undefined;
  return {
    failures: row.failures,
    subjects: Array.isArray(row.subjects) ? row.subjects.filter((item): item is string => typeof item === "string") : [],
    windowStartedAt: row.windowStartedAt.getTime(),
    blockedUntil: row.blockedUntil?.getTime() ?? null,
  };
}

export async function readAuthRateBucket(key: string): Promise<RateBucket | undefined> {
  const client = await getRedis();
  if (client) {
    const raw = await client.get(`${AUTH_BUCKET_PREFIX}${key}`);
    if (!raw) return undefined;
    return JSON.parse(raw) as RateBucket;
  }

  const row = await db.authRateBucket.findUnique({ where: { key } });
  return toBucket(row);
}

export async function writeAuthRateBucket(key: string, bucket: RateBucket): Promise<void> {
  const client = await getRedis();
  if (client) {
    const ttlMs = Math.max(
      bucket.blockedUntil ? bucket.blockedUntil - Date.now() : 0,
      60 * 60 * 1000,
    );
    await client.set(`${AUTH_BUCKET_PREFIX}${key}`, JSON.stringify(bucket), "PX", ttlMs);
    return;
  }

  await db.authRateBucket.upsert({
    where: { key },
    create: {
      key,
      failures: bucket.failures,
      subjects: bucket.subjects,
      windowStartedAt: new Date(bucket.windowStartedAt),
      blockedUntil: bucket.blockedUntil ? new Date(bucket.blockedUntil) : null,
    },
    update: {
      failures: bucket.failures,
      subjects: bucket.subjects,
      windowStartedAt: new Date(bucket.windowStartedAt),
      blockedUntil: bucket.blockedUntil ? new Date(bucket.blockedUntil) : null,
    },
  });
}

export async function deleteAuthRateBuckets(keys: string[]): Promise<void> {
  const client = await getRedis();
  if (client && keys.length > 0) {
    await client.del(...keys.map((key) => `${AUTH_BUCKET_PREFIX}${key}`));
  }
  await db.authRateBucket.deleteMany({ where: { key: { in: keys } } });
}
