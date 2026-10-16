import { describe, expect, it } from "vitest";
import {
  buildFinancialInsights,
  computeConcentration,
  detectExpenseAnomaly,
  hasThreeMonthIncreasingTrend,
  medianAmount,
  recurringAnnualEquivalent,
  recurringMonthlyEquivalent,
} from "@/lib/finance/financial-insights";
import { safePercentChange } from "@/lib/finance/kpi";

describe("financial-insights", () => {
  it("safePercentChange com zero anterior", () => {
    expect(safePercentChange("100", "0")).toBeNull();
  });

  it("mediana", () => {
    expect(medianAmount(["10", "20", "30"])).toBe("20.00");
    expect(medianAmount(["10", "30"])).toBe("20.00");
  });

  it("tendência três meses", () => {
    expect(hasThreeMonthIncreasingTrend(["300", "330", "360"])).toBe(true);
    expect(hasThreeMonthIncreasingTrend(["300", "290", "360"])).toBe(false);
  });

  it("concentração top 3", () => {
    const c = computeConcentration([
      { categoryName: "A", amount: "450" },
      { categoryName: "B", amount: "200" },
      { categoryName: "C", amount: "150" },
      { categoryName: "D", amount: "200" },
    ]);
    expect(c.top3SharePercent).toBe(85);
  });

  it("equivalente mensal trimestral", () => {
    expect(recurringMonthlyEquivalent("300", "QUARTERLY")).toBe("100.00");
    expect(recurringAnnualEquivalent("50")).toBe("600.00");
  });

  it("anomalia com histórico insuficiente", () => {
    expect(detectExpenseAnomaly("500", ["10", "12"]).flagged).toBe(false);
  });

  it("determinismo do bundle", () => {
    const input = {
      workspaceId: "ws1",
      civilYear: 2026,
      civilMonth: 10,
      expenseMovements: [],
      incomeMonth: "2000",
      incomePreviousMonth: "1900",
      expenseMonth: "1850",
      expensePreviousMonth: "1700",
      economicResultMonth: "150",
      budgetLines: [],
      subscriptions: [
        {
          id: "s1",
          name: "Sub A",
          expectedAmount: "10",
          frequency: "MONTHLY" as const,
          status: "ACTIVE",
        },
      ],
      upcomingWeekOutflows: "430",
      savingsRateCurrent: 5,
      savingsRatePrevious: 8,
    };
    const a = buildFinancialInsights(input);
    const b = buildFinancialInsights(input);
    expect(a.insights.map((i) => i.id)).toEqual(b.insights.map((i) => i.id));
  });
});
