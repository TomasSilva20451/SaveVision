import { beforeAll, describe, expect, it } from "vitest";

type DbClient = typeof import("@/lib/db").db;

describe("recordLiabilityPayment (PostgreSQL)", () => {
  let ready = false;
  let db: DbClient;
  let joaoId = "";
  let joaoWs = "";
  let accountId = "";
  let recordLiabilityPayment: typeof import("@/server/services/patrimony").recordLiabilityPayment;
  let createLiability: typeof import("@/server/services/patrimony").createLiability;

  beforeAll(async () => {
    await import("dotenv/config");
    if (!process.env.DATABASE_URL) return;
    try {
      ({ db } = await import("@/lib/db"));
      await db.$queryRaw`SELECT 1`;
    } catch {
      return;
    }
    const patrimony = await import("@/server/services/patrimony");
    recordLiabilityPayment = patrimony.recordLiabilityPayment;
    createLiability = patrimony.createLiability;

    const joao = await db.user.findUnique({
      where: { email: "user1@example.local" },
    });
    if (!joao) return;
    joaoId = joao.id;
    const member = await db.workspaceMember.findFirst({
      where: { userId: joaoId, status: "ACTIVE", workspace: { type: "PERSONAL" } },
    });
    if (!member) return;
    joaoWs = member.workspaceId;
    const account = await db.financialAccount.findFirst({
      where: { workspaceId: joaoWs, type: "CURRENT" },
    });
    accountId = account?.id ?? "";
    ready = Boolean(accountId);
  });

  it("WITH_BANK: saldo e passivo coerentes com cenário 16.1", async () => {
    if (!ready) return;

    const liability = await createLiability(joaoId, joaoWs, {
      title: `Teste integração ${Date.now()}`,
      type: "OTHER",
      outstandingBalance: "10000",
    });
    if (!liability) return;

    const beforeBalance = await db.transaction.findMany({
      where: { accountId, deletedAt: null },
    });

    const updated = await recordLiabilityPayment(joaoId, joaoWs, {
      liabilityId: liability.id,
      paidAt: new Date(),
      principalAmount: "450",
      interestAmount: "40",
      feesAmount: "10",
      mode: "WITH_BANK",
      accountId,
      idempotencyKey: `e2e-key-${liability.id}`,
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.liability.outstandingBalance.toString()).toBe("9550");
    }

    const movements = await db.transaction.findMany({
      where: { accountId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    expect(movements.length).toBeGreaterThan(beforeBalance.length);

    const payments = await db.liabilityPayment.findMany({
      where: { liabilityId: liability.id },
    });
    expect(payments).toHaveLength(1);

    const retry = await recordLiabilityPayment(joaoId, joaoWs, {
      liabilityId: liability.id,
      paidAt: new Date(),
      principalAmount: "450",
      interestAmount: "40",
      feesAmount: "10",
      mode: "WITH_BANK",
      accountId,
      idempotencyKey: `e2e-key-${liability.id}`,
    });
    expect(retry.ok).toBe(true);
    if (retry.ok) {
      expect(retry.liability.outstandingBalance.toString()).toBe("9550");
    }
    const paymentsAfter = await db.liabilityPayment.findMany({
      where: { liabilityId: liability.id },
    });
    expect(paymentsAfter).toHaveLength(1);
  });

  it("rejeita idempotencyKey reutilizada com payload diferente", async () => {
    if (!ready) return;
    const liability = await createLiability(joaoId, joaoWs, {
      title: `Idempot conflict ${Date.now()}`,
      type: "OTHER",
      outstandingBalance: "1000",
    });
    if (!liability) return;
    const key = `conflict-${liability.id}`;
    const ok = await recordLiabilityPayment(joaoId, joaoWs, {
      liabilityId: liability.id,
      paidAt: new Date(),
      principalAmount: "100",
      interestAmount: "0",
      feesAmount: "0",
      mode: "LIABILITY_ONLY",
      idempotencyKey: key,
    });
    expect(ok.ok).toBe(true);
    const bad = await recordLiabilityPayment(joaoId, joaoWs, {
      liabilityId: liability.id,
      paidAt: new Date(),
      principalAmount: "200",
      interestAmount: "0",
      feesAmount: "0",
      mode: "LIABILITY_ONLY",
      idempotencyKey: key,
    });
    expect(bad.ok).toBe(false);
  });

  it("concorrência: duas chamadas paralelas com a mesma idempotencyKey", async () => {
    if (!ready) return;
    const liability = await createLiability(joaoId, joaoWs, {
      title: `Concurrent ${Date.now()}`,
      type: "OTHER",
      outstandingBalance: "5000",
    });
    if (!liability) return;
    const key = `parallel-${liability.id}`;
    const input = {
      liabilityId: liability.id,
      paidAt: new Date(),
      principalAmount: "10",
      interestAmount: "0",
      feesAmount: "0",
      mode: "LIABILITY_ONLY" as const,
      idempotencyKey: key,
    };
    const [a, b] = await Promise.all([
      recordLiabilityPayment(joaoId, joaoWs, input),
      recordLiabilityPayment(joaoId, joaoWs, input),
    ]);
    expect(a.ok && a.liability.outstandingBalance.toString()).toBe("4990");
    expect(b.ok && b.liability.outstandingBalance.toString()).toBe("4990");
    const count = await db.liabilityPayment.count({
      where: { liabilityId: liability.id, idempotencyKey: key },
    });
    expect(count).toBe(1);
  });
});
