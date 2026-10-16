import { describe, expect, it } from "vitest";
import { calculateFinancialHealthScore } from "@/lib/finance/health-score";

describe("health-score", () => {
  it("produz score entre 0 e 100 com fatores explicáveis", () => {
    const result = calculateFinancialHealthScore({
      savingsBalance: "4800",
      monthlyExpenses: "800",
      emergencyTargetMonths: 6,
      monthlyIncome: "2000",
      monthlyCashFlow: "400",
      goalProgressAverage: 50,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.factors.length).toBeGreaterThan(0);
  });
});
