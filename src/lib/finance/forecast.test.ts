import { describe, expect, it } from "vitest";
import {
  buildRuleBasedAlerts,
  deterministicBalanceForecast,
} from "@/lib/finance/forecast";

describe("forecast", () => {
  it("projeta saldo de forma determinística", () => {
    const points = deterministicBalanceForecast({
      startingBalance: "1000",
      expectedMonthlyIncome: "500",
      expectedMonthlyExpenses: "300",
      horizonMonths: 2,
    });
    expect(points[1]?.projectedBalance).toBe("1400.00");
  });

  it("emite alertas por regras", () => {
    const alerts = buildRuleBasedAlerts({
      cashFlowMonth: "-50",
      savingsBalance: "100",
      emergencyTarget: "500",
    });
    expect(alerts.some((a) => a.code === "negative_cashflow")).toBe(true);
  });
});
