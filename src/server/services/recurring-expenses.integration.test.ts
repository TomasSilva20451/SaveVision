import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decimal } from "@/lib/finance/money";

describe("recurring expenses (PostgreSQL)", () => {
  let ready = true;
  let db: typeof import("@/lib/db").db;
  let joaoId: string;
  let joaoWs: string;
  let accountId: string;
  let categoryId: string;
  let createRecurringExpense: typeof import("@/server/services/recurring-expenses").createRecurringExpense;
  let confirmRecurringExpenseOccurrence: typeof import("@/server/services/recurring-expenses").confirmRecurringExpenseOccurrence;
  let listAccountsWithBalances: typeof import("@/server/services/accounts").listAccountsWithBalances;

  beforeAll(async () => {
    try {
      ({ db } = await import("@/lib/db"));
      await db.$queryRaw`SELECT 1`;
      const mod = await import("@/server/services/recurring-expenses");
      createRecurringExpense = mod.createRecurringExpense;
      confirmRecurringExpenseOccurrence = mod.confirmRecurringExpenseOccurrence;
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
      const category = await db.category.findFirst({ where: { workspaceId: joaoWs } });
      if (!account || !category) {
        ready = false;
        return;
      }
      accountId = account.id;
      categoryId = category.id;
    } catch {
      ready = false;
    }
  });

  afterAll(async () => {
    if (db) await db.$disconnect();
  });

  it("confirmar pagamento altera saldo; previsto não altera antes", async () => {
    if (!ready) return;

    const before = await listAccountsWithBalances(joaoId, joaoWs);
    const startBal = before?.find((a) => a.id === accountId)?.currentBalance ?? "0";

    const series = await createRecurringExpense(joaoId, joaoWs, {
      name: `Test net ${Date.now()}`,
      categoryId,
      expectedAmount: "45",
      frequency: "MONTHLY",
      startDate: new Date(),
      dueDayOfMonth: 15,
      accountId,
    });
    expect(series).toBeTruthy();

    const afterCreate = await listAccountsWithBalances(joaoId, joaoWs);
    const midBal = afterCreate?.find((a) => a.id === accountId)?.currentBalance;
    expect(midBal).toBe(startBal);

    const occ = await db.recurringExpenseOccurrence.findFirst({
      where: { recurringExpenseId: series!.id },
      orderBy: { dueDate: "asc" },
    });
    expect(occ).toBeTruthy();

    const paid = await confirmRecurringExpenseOccurrence(joaoId, joaoWs, {
      occurrenceId: occ!.id,
      accountId,
      actualAmount: "47",
      paidAt: new Date(),
      idempotencyKey: `e2e-${occ!.id}`,
    });
    expect(paid.ok).toBe(true);

    const afterPay = await listAccountsWithBalances(joaoId, joaoWs);
    const endBal = decimal(afterPay!.find((a) => a.id === accountId)!.currentBalance);
    expect(endBal.toFixed(2)).toBe(decimal(startBal).minus("47").toFixed(2));

    const retry = await confirmRecurringExpenseOccurrence(joaoId, joaoWs, {
      occurrenceId: occ!.id,
      accountId,
      actualAmount: "47",
      paidAt: new Date(),
      idempotencyKey: `e2e-${occ!.id}`,
    });
    expect(retry.ok && retry.alreadyConfirmed).toBe(true);

    const txCount = await db.transaction.count({
      where: { workspaceId: joaoWs, description: series!.name, type: "EXPENSE" },
    });
    expect(txCount).toBe(1);
  });
});
