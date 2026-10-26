import { getFixedWindowRateLimitStore } from "@/server/security/rate-limit-backend";
import type { FixedWindowRateLimitResult } from "@/server/security/rate-limit-types";

export async function consumeFixedWindowRateLimit(input: {
  scope: string;
  subject: string;
  limit: number;
  windowMs: number;
}): Promise<FixedWindowRateLimitResult & { backend: string }> {
  const store = await getFixedWindowRateLimitStore();
  const key = `${input.scope}:${input.subject}`;
  const result = await store.consume(key, input.limit, input.windowMs);
  return { ...result, backend: store.backend };
}
