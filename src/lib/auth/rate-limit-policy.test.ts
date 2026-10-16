import { afterEach, describe, expect, it, vi } from "vitest";
import { isLoginRateLimitBypassAllowed } from "@/lib/auth/rate-limit-policy";

describe("rate-limit-policy", () => {
  const env = process.env;

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...env };
  });

  it("nunca permite bypass em produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FINTWIN_DISABLE_LOGIN_RATE_LIMIT", "1");
    expect(isLoginRateLimitBypassAllowed()).toBe(false);
  });

  it("permite bypass só em dev com flag explícita", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("FINTWIN_DISABLE_LOGIN_RATE_LIMIT", "1");
    expect(isLoginRateLimitBypassAllowed()).toBe(true);
  });
});
