import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { civilDateIsoToInstant } from "@/lib/datetime/civil-date";

describe("postponeExpenseOccurrence (PostgreSQL)", () => {
  let ready = true;
  let db: typeof import("@/lib/db").db;
  let joaoId: string;
  let joaoWs: string;
  let categoryId: string;
  let createRecurringExpense: typeof import("@/server/services/recurring-expenses").createRecurringExpense;
  let postponeExpenseOccurrence: typeof import("@/server/services/recurring-expenses").postponeExpenseOccurrence;

  beforeAll(async () => {
    try {
      ({ db } = await import("@/lib/db"));
      await db.$queryRaw`SELECT 1`;
      const mod = await import("@/server/services/recurring-expenses");
      createRecurringExpense = mod.createRecurringExpense;
      postponeExpenseOccurrence = mod.postponeExpenseOccurrence;
      const joao = await db.user.findFirst({ where: { email: "user1@example.local" } });
      const ws = await db.workspace.findFirst({
        where: { createdById: joao!.id, type: "PERSONAL" },
      });
      const category = await db.category.findFirst({ where: { workspaceId: ws!.id } });
      if (!joao || !ws || !category) {
        ready = false;
        return;
      }
      joaoId = joao.id;
      joaoWs = ws.id;
      categoryId = category.id;
    } catch {
      ready = false;
    }
  });

  afterAll(async () => {
    if (db) await db.$disconnect();
  });

  it("adiamento altera dueDate e status POSTPONED", async () => {
    if (!ready) return;
    const series = await createRecurringExpense(joaoId, joaoWs, {
      name: `E2E17a-int-postpone-${Date.now()}`,
      categoryId,
      expectedAmount: "12",
      frequency: "MONTHLY",
      startDate: new Date(),
      dueDayOfMonth: 16,
    });
    expect(series).toBeTruthy();
    const occ = await db.recurringExpenseOccurrence.findFirst({
      where: { recurringExpenseId: series!.id },
      orderBy: { anchorDate: "asc" },
    });
    expect(occ).toBeTruthy();
    const target = civilDateIsoToInstant("2026-12-05");
    const ok = await postponeExpenseOccurrence(joaoId, joaoWs, occ!.id, target);
    expect(ok).toBe(true);
    const fresh = await db.recurringExpenseOccurrence.findUnique({ where: { id: occ!.id } });
    expect(fresh?.status).toBe("POSTPONED");
    expect(fresh?.dueDate.getTime()).toBe(target.getTime());
  });
});
