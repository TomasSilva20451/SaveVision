import { describe, expect, it } from "vitest";
import { startOfCivilDay } from "@/lib/datetime/civil-date";
import {
  alertDedupeKey,
  evaluateFinancialAlertCandidates,
  isOccurrenceDueSoon,
  isOccurrenceOverdue,
  minProjectedBalanceInTimeline,
  severityRank,
} from "@/lib/finance/financial-alerts";

describe("financial-alerts motor", () => {
  const baseInput = {
    workspaceId: "ws-1",
    civilYear: 2026,
    civilMonth: 10,
    treasuryTimeline30: [
      { civilDate: "2026-10-16", projectedBalance: "1500.00", cumulativeInflows: "0", cumulativeOutflows: "0" },
      { civilDate: "2026-10-20", projectedBalance: "-50.00", cumulativeInflows: "0", cumulativeOutflows: "0" },
    ],
    realBalance: "1500.00",
    budgetLines: [],
    recurringDueSoon: [],
    recurringOverdue: [],
    overdueIncome: [],
    emergencyFundCurrent: null,
    emergencyFundTarget: null,
    configurationWarnings: [],
    linkedRecurringRisks: [],
    anomalyInsights: [],
    asOf: startOfCivilDay({ year: 2026, month: 10, day: 16 }),
  };

  it("deteta saldo projetado negativo como CRITICAL", () => {
    const alerts = evaluateFinancialAlertCandidates(baseInput);
    const neg = alerts.find((a) => a.type === "NEGATIVE_PROJECTED_BALANCE");
    expect(neg?.severity).toBe("CRITICAL");
    expect(neg?.deduplicationKey).toBe(
      alertDedupeKey("ws-1", "NEGATIVE_PROJECTED_BALANCE", ["30d"]),
    );
  });

  it("resolve deduplicação estável por workspace e tipo", () => {
    const key = alertDedupeKey("ws-1", "BUDGET_EXCEEDED", ["2026-10", "cat-1"]);
    expect(key).toContain("BUDGET_EXCEEDED");
    expect(key).not.toContain("50.00");
  });

  it("classifica orçamento excedido", () => {
    const alerts = evaluateFinancialAlertCandidates({
      ...baseInput,
      treasuryTimeline30: [{ civilDate: "2026-10-16", projectedBalance: "500.00", cumulativeInflows: "0", cumulativeOutflows: "0" }],
      budgetLines: [
        {
          categoryId: "food",
          categoryName: "Alimentação",
          limitAmount: "400.00",
          spentAmount: "450.00",
        },
      ],
    });
    expect(alerts.some((a) => a.type === "BUDGET_EXCEEDED")).toBe(true);
  });

  it("marca recorrência vencida como HIGH", () => {
    const due = startOfCivilDay({ year: 2026, month: 10, day: 10 });
    const alerts = evaluateFinancialAlertCandidates({
      ...baseInput,
      treasuryTimeline30: [{ civilDate: "2026-10-16", projectedBalance: "500.00", cumulativeInflows: "0", cumulativeOutflows: "0" }],
      recurringOverdue: [
        {
          occurrenceId: "occ-1",
          recurringId: "rec-1",
          name: "Internet",
          dueDate: due,
          status: "EXPECTED",
          expectedAmount: "45.00",
        },
      ],
    });
    const row = alerts.find((a) => a.type === "RECURRING_EXPENSE_OVERDUE");
    expect(row?.severity).toBe("HIGH");
  });

  it("minProjectedBalanceInTimeline", () => {
    const min = minProjectedBalanceInTimeline(baseInput.treasuryTimeline30);
    expect(min?.minBalance).toBe("-50.00");
    expect(min?.civilDate).toBe("2026-10-20");
  });

  it("severityRank ordena CRITICAL acima de INFO", () => {
    expect(severityRank("CRITICAL")).toBeGreaterThan(severityRank("INFO"));
  });

  it("isOccurrenceOverdue e dueSoon", () => {
    const asOf = startOfCivilDay({ year: 2026, month: 10, day: 16 });
    const past = startOfCivilDay({ year: 2026, month: 10, day: 10 });
    const soon = startOfCivilDay({ year: 2026, month: 10, day: 18 });
    expect(isOccurrenceOverdue(past, asOf)).toBe(true);
    expect(isOccurrenceDueSoon(soon, asOf, 3)).toBe(true);
  });
});
