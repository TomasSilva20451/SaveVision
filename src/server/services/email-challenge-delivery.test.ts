import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const send = vi.fn();
const revoke = vi.fn();

vi.mock("@/server/providers/email/registry", () => ({
  resolveEmailDeliveryProvider: () => ({
    name: "mock",
    isConfigured: () => true,
    send,
  }),
}));

vi.mock("@/server/services/auth-protection", () => ({
  revokeEmailChallengeByToken: (...args: unknown[]) => revoke(...args),
}));

describe("deliverEmailChallenge", () => {
  beforeEach(() => {
    send.mockReset();
    revoke.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("envia verificação quando SMTP está configurado", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.test");
    const { deliverEmailChallenge } = await import("@/server/services/email-challenge-delivery");
    const result = await deliverEmailChallenge({
      token: "tok",
      email: "user@test.local",
      purpose: "VERIFY_EMAIL",
      verifyContext: "account",
    });
    expect(result.delivered).toBe(true);
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]?.to).toBe("user@test.local");
  });

  it("revoga token e lança erro quando SMTP falha", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.test");
    send.mockRejectedValueOnce(new Error("connection refused"));
    const { deliverEmailChallenge, EmailDeliveryFailedError } = await import(
      "@/server/services/email-challenge-delivery"
    );
    await expect(
      deliverEmailChallenge({
        token: "bad",
        email: "user@test.local",
        purpose: "RECOVER_ACCOUNT",
      }),
    ).rejects.toBeInstanceOf(EmailDeliveryFailedError);
    expect(revoke).toHaveBeenCalledWith("bad");
  });
});
