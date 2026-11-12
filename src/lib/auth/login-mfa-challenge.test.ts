import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("LoginMfaChallenge", () => {
  let ready = false;
  let db: typeof import("@/lib/db").db;
  let issueLoginMfaChallenge: typeof import("@/lib/auth/login-mfa-challenge").issueLoginMfaChallenge;
  let assertLoginMfaChallengeForEmail: typeof import("@/lib/auth/login-mfa-challenge").assertLoginMfaChallengeForEmail;
  let resolveLoginMfaChallenge: typeof import("@/lib/auth/login-mfa-challenge").resolveLoginMfaChallenge;
  let consumeLoginMfaChallenge: typeof import("@/lib/auth/login-mfa-challenge").consumeLoginMfaChallenge;
  let revokeLoginMfaChallenge: typeof import("@/lib/auth/login-mfa-challenge").revokeLoginMfaChallenge;
  let LOGIN_MFA_CHALLENGE_MS: number;

  let userId = "";
  let email = "";

  beforeAll(async () => {
    await import("dotenv/config");
    if (!process.env.DATABASE_URL) return;
    try {
      ({ db } = await import("@/lib/db"));
      await db.$queryRaw`SELECT 1`;
    } catch {
      return;
    }
    const mod = await import("@/lib/auth/login-mfa-challenge");
    issueLoginMfaChallenge = mod.issueLoginMfaChallenge;
    assertLoginMfaChallengeForEmail = mod.assertLoginMfaChallengeForEmail;
    resolveLoginMfaChallenge = mod.resolveLoginMfaChallenge;
    consumeLoginMfaChallenge = mod.consumeLoginMfaChallenge;
    revokeLoginMfaChallenge = mod.revokeLoginMfaChallenge;
    LOGIN_MFA_CHALLENGE_MS = mod.LOGIN_MFA_CHALLENGE_MS;
    const user = await db.user.findFirst({ select: { id: true, email: true } });
    if (!user) return;
    userId = user.id;
    email = user.email;
    ready = true;
  });

  afterEach(async () => {
    if (!ready || !userId) return;
    await db.loginMfaChallenge.deleteMany({ where: { userId } });
  });

  it.skipIf(() => !ready)("cria desafio único e revoga pendentes anteriores", async () => {
    const first = await issueLoginMfaChallenge({ userId, mfaGate: "mfa-totp", ip: "127.0.0.1", deviceId: "dev-1" });
    const second = await issueLoginMfaChallenge({ userId, mfaGate: "mfa-totp", ip: "127.0.0.1", deviceId: "dev-1" });
    expect(first).not.toBe(second);
    expect(await resolveLoginMfaChallenge(first)).toBeNull();
    const resolvedSecond = await assertLoginMfaChallengeForEmail(second, email);
    expect(resolvedSecond?.userId).toBe(userId);
  });

  it.skipIf(() => !ready)("expira desafio após TTL", async () => {
    const token = await issueLoginMfaChallenge({ userId, mfaGate: "mfa-totp", ip: "127.0.0.1" });
    await db.loginMfaChallenge.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect(await assertLoginMfaChallengeForEmail(token, email)).toBeNull();
  });

  it.skipIf(() => !ready)("invalida desafio após consumo", async () => {
    const token = await issueLoginMfaChallenge({ userId, mfaGate: "mfa-totp", ip: "127.0.0.1" });
    const challenge = await assertLoginMfaChallengeForEmail(token, email);
    expect(challenge).toBeTruthy();
    await consumeLoginMfaChallenge(challenge!.id);
    expect(await resolveLoginMfaChallenge(token)).toBeNull();
  });

  it.skipIf(() => !ready)("revoga ao cancelar", async () => {
    const token = await issueLoginMfaChallenge({ userId, mfaGate: "mfa-totp", ip: "127.0.0.1" });
    await revokeLoginMfaChallenge(token);
    expect(await resolveLoginMfaChallenge(token)).toBeNull();
  });
});
