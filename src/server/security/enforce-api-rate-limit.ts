import { NextResponse } from "next/server";
import {
  API_RATE_LIMIT_RULES,
  clientIpFromRequest,
  type ApiRateLimitScope,
} from "@/lib/security/api-rate-limit-policy";
import { consumeFixedWindowRateLimit } from "@/server/security/fixed-window-rate-limit";

export async function enforceApiRateLimit(
  request: Request,
  input: { scope: ApiRateLimitScope; userId?: string | null },
): Promise<NextResponse | null> {
  if (process.env.FINTWIN_DISABLE_API_RATE_LIMIT === "1") return null;

  const rule = API_RATE_LIMIT_RULES[input.scope];
  const subject =
    input.userId != null && input.userId.length > 0
      ? `user:${input.userId}`
      : `ip:${clientIpFromRequest(request)}`;

  const result = await consumeFixedWindowRateLimit({
    scope: input.scope,
    subject,
    limit: rule.limit,
    windowMs: rule.windowMs,
  });

  if (result.allowed) return null;

  return NextResponse.json(
    { error: rule.message, retryAfterSeconds: result.retryAfterSeconds },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(rule.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Backend": result.backend,
      },
    },
  );
}
