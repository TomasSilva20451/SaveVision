import { describe, expect, it } from "vitest";
import { simulateBalanceScenario } from "@/lib/finance/scenario-simulator";

describe("scenario-simulator", () => {
  it("projeta saldo mês a mês", () => {
    const series = simulateBalanceScenario({
      currentBalance: "1000",
      monthlyIncomeDelta: "100",
      monthlyExpenseDelta: "50",
      months: 3,
    });
    expect(series).toHaveLength(3);
    expect(series[2]?.projectedBalance).toBe("1150.00");
  });
});
