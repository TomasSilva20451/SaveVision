import { db } from "@/lib/db";
import type { FixedWindowRateLimitStore } from "@/server/security/rate-limit-types";

export const postgresFixedWindowStore: FixedWindowRateLimitStore = {
  backend: "postgres",
  async consume(key, limit, windowMs) {
    const now = Date.now();
    const windowStart = new Date(now);

    const result = await db.$transaction(async (tx) => {
      const row = await tx.rateLimitCounter.findUnique({ where: { key } });
      if (!row || now - row.windowStartedAt.getTime() >= windowMs) {
        await tx.rateLimitCounter.upsert({
          where: { key },
          create: { key, count: 1, windowStartedAt: windowStart },
          update: { count: 1, windowStartedAt: windowStart },
        });
        return { count: 1, windowStartedAt: windowStart };
      }

      const count = row.count + 1;
      await tx.rateLimitCounter.update({
        where: { key },
        data: { count },
      });
      return { count, windowStartedAt: row.windowStartedAt };
    });

    const elapsed = now - result.windowStartedAt.getTime();
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
    return {
      allowed: result.count <= limit,
      count: result.count,
      limit,
      retryAfterSeconds,
    };
  },
};
