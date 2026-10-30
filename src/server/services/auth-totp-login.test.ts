import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type DbClient = typeof import("@/lib/db").db;

describe("TOTP enroll e segundo factor (PostgreSQL)", () => {
  let ready = false;
  let db: DbClient;
  let userId = "";
  let beginTotpEnrollment: typeof import("@/server/services/auth-protection").beginTotpEnrollment;
  let confirmTotpEnrollment: typeof import("@/server/services/auth-protection").confirmTotpEnrollment;
  let verifySecondFactor: typeof import("@/server/services/auth-protection").verifySecondFactor;
  let disableTotp: typeof import("@/server/services/auth-protection").disableTotp;
  let generateTotpCode: typeof import("@/lib/auth/totp").generateTotpCode;

  beforeAll(async () => {
    await import("dotenv/config");
    if (!process.env.DATABASE_URL) return;
    try {
      ({ db } = await import("@/lib/db"));
      await db.$queryRaw`SELECT 1`;
    } catch {
      return;
    }

    ({
      beginTotpEnrollment,
      confirmTotpEnrollment,
      verifySecondFactor,
      disableTotp,
    } = await import("@/server/services/auth-protection"));
    ({ generateTotpCode } = await import("@/lib/auth/totp"));

    const user = await db.user.findUnique({ where: { email: "user2@example.local" } });
    if (!user) return;
    userId = user.id;
    await disableTotp(userId);
    ready = true;
  });

  afterAll(async () => {
    if (!ready || !userId) return;
    await disableTotp(userId);
  });

  it("activa TOTP e verifica código no login", async () => {
    if (!ready) return;

    const enrollment = await beginTotpEnrollment(userId, "user2@example.local");
    const code = generateTotpCode(enrollment.secret);
    const recovery = await confirmTotpEnrollment(userId, code);
    expect(recovery?.length).toBeGreaterThan(0);

    const ok = await verifySecondFactor(userId, { totp: generateTotpCode(enrollment.secret) });
    expect(ok).toBe(true);

    const bad = await verifySecondFactor(userId, { totp: "000000" });
    expect(bad).toBe(false);
  });
});
