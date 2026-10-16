import { describe, expect, it } from "vitest";
import { startOfCivilDay } from "@/lib/datetime/civil-date";
import {
  deduplicateTreasuryEvents,
  generateLiabilityMonthlyOutflows,
} from "@/lib/finance/treasury-liability-events";

describe("treasury-liability-events", () => {
  it("gera saídas de caixa mensais até outstanding esgotar", () => {
    const anchor = { year: 2026, month: 1, day: 15 };
    const horizonStart = startOfCivilDay({ year: 2026, month: 1, day: 1 });
    const horizonEnd = startOfCivilDay({ year: 2026, month: 4, day: 1 });
    const events = generateLiabilityMonthlyOutflows({
      liabilityId: "l1",
      title: "Empréstimo",
      monthlyPayment: "500",
      outstandingBalance: "1200",
      scheduleAnchor: anchor,
      paymentDueDayOfMonth: 15,
      horizonStart,
      horizonEnd,
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.amount).toBe("500.00");
    const total = events.reduce((sum, e) => sum + Number(e.amount), 0);
    expect(total).toBeLessThanOrEqual(1200);
  });

  it("deduplica por origem e id", () => {
    const base = {
      label: "X",
      dueDate: new Date(),
      amount: "10",
      direction: "outflow" as const,
      source: "RECURRING_EXPENSE" as const,
      sourceRef: "r1",
      movementKind: "PREVISTO" as const,
    };
    const merged = deduplicateTreasuryEvents([
      { ...base, id: "a" },
      { ...base, id: "a" },
      { ...base, id: "b" },
    ]);
    expect(merged).toHaveLength(2);
  });

  it("sem paymentDueDayOfMonth não gera prestações", () => {
    const events = generateLiabilityMonthlyOutflows({
      liabilityId: "l2",
      title: "Sem vencimento",
      monthlyPayment: "600",
      outstandingBalance: "10000",
      scheduleAnchor: { year: 2026, month: 1, day: 1 },
      paymentDueDayOfMonth: null,
      horizonStart: startOfCivilDay({ year: 2026, month: 1, day: 1 }),
      horizonEnd: startOfCivilDay({ year: 2026, month: 6, day: 1 }),
    });
    expect(events).toHaveLength(0);
  });
});
