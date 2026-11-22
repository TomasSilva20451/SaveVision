import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { civilDateIsoToInstant } from "@/lib/datetime/civil-date";
import { decimal } from "@/lib/finance/money";

describe("income confirmation reversal (PostgreSQL)", () => {
  let ready = true;
  let db: typeof import("@/lib/db").db;
  let joaoId: string;
  let joaoWs: string;
  let accountId: string;
  let createFamilyIncomeSeries: typeof import("@/server/services/income").createFamilyIncomeSeries;
  let confirmIncomeOccurrence: typeof import("@/server/services/income").confirmIncomeOccurrence;
  let restoreIncomeOccurrence: typeof import("@/server/services/income").restoreIncomeOccurrence;
  let listAccountsWithBalances: typeof import("@/server/services/accounts").listAccountsWithBalances;

  beforeAll(async () => {
    try {
      ({ db } = await import("@/lib/db"));
      await db.$queryRaw`SELECT 1`;
      const mod = await import("@/server/services/income");
      createFamilyIncomeSeries = mod.createFamilyIncomeSeries;
      confirmIncomeOccurrence = mod.confirmIncomeOccurrence;
      restoreIncomeOccurrence = mod.restoreIncomeOccurrence;
      listAccountsWithBalances = (await import("@/server/services/accounts")).listAccountsWithBalances;

      const joao = await db.user.findFirst({ where: { email: "user1@example.local" } });
      if (!joao) {
        ready = false;
        return;
      }
      joaoId = joao.id;
      const ws = await db.workspace.findFirst({
        where: { createdById: joaoId, type: "PERSONAL" },
      });
      if (!ws) {
        ready = false;
        return;
      }
      joaoWs = ws.id;
      const account = await db.financialAccount.findFirst({ where: { workspaceId: joaoWs } });
      if (!account) {
        ready = false;
        return;
      }
      accountId = account.id;
    } catch {
      ready = false;
    }
  }, 60_000);

  afterAll(async () => {
    if (db) await db.$disconnect();
  }, 30_000);

  it("restoreIncomeOccurrence repõe saldo e ocorrência EXPECTED", async () => {
    if (!ready) return;

    const before = await listAccountsWithBalances(joaoId, joaoWs);
    const startBal = before?.find((a) => a.id === accountId)?.currentBalance ?? "0";

    const todayIso = new Date().toISOString().slice(0, 10);
    const series = await createFamilyIncomeSeries(joaoId, joaoWs, {
      accountId,
      familyOrigin: `Reverter ${Date.now()}`,
      amount: "33.50",
      frequency: "MONTHLY",
      nextDueAt: civilDateIsoToInstant(todayIso),
      certainty: "HIGH",
    });
    expect(series).toBeTruthy();

    const occ = await db.incomeOccurrence.findFirst({
      where: { seriesId: series!.id },
      orderBy: { scheduledFor: "asc" },
    });
    expect(occ).toBeTruthy();

    const confirmed = await confirmIncomeOccurrence(joaoId, joaoWs, occ!.id, new Date());
    expect(confirmed.ok).toBe(true);

    const received = await db.incomeOccurrence.findUnique({
      where: { id: occ!.id },
      select: { transactionId: true },
    });
    expect(received?.transactionId).toBeTruthy();

    const afterConfirm = await listAccountsWithBalances(joaoId, joaoWs);
    const midBal = decimal(afterConfirm!.find((a) => a.id === accountId)!.currentBalance);
    expect(midBal.minus(startBal).toFixed(2)).toBe("33.50");

    const restored = await restoreIncomeOccurrence(joaoId, joaoWs, occ!.id);
    expect(restored.ok).toBe(true);

    const afterRestore = await listAccountsWithBalances(joaoId, joaoWs);
    const endBal = afterRestore?.find((a) => a.id === accountId)?.currentBalance;
    expect(endBal).toBe(startBal);

    const freshOccurrence = await db.incomeOccurrence.findUnique({ where: { id: occ!.id } });
    expect(freshOccurrence?.status).toBe("EXPECTED");
    expect(freshOccurrence?.transactionId).toBeNull();

    const activeTx = await db.transaction.count({
      where: {
        workspaceId: joaoWs,
        id: received!.transactionId!,
        deletedAt: null,
      },
    });
    expect(activeTx).toBe(0);
  });
});