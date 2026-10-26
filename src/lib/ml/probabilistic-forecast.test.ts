import { describe, expect, it } from "vitest";

import {
  assessLiquidityRisk,
  explainableSavingsRecommendation,
  forecastCashBalanceDistribution,
} from "@/lib/ml/probabilistic-forecast";

describe("previsões probabilísticas explicáveis", () => {
  it("produz bandas ordenadas sem somar dinheiro com number", () => {
    const result = forecastCashBalanceDistribution({
      currentBalance: "1000",
      monthlyNetFlows: ["100", "200", "0", "150", "50", "100"],
      horizonMonths: 3,
    });
    expect(Number(result.p10)).toBeLessThanOrEqual(Number(result.p50));
    expect(Number(result.p50)).toBeLessThanOrEqual(Number(result.p90));
    expect(result.confidence).toBe("MEDIUM");
  });

  it("sinaliza risco alto se o P10 ficar negativo", () => {
    const forecast = forecastCashBalanceDistribution({
      currentBalance: "50",
      monthlyNetFlows: ["-100", "-120", "-80", "-140", "-90", "-110"],
      horizonMonths: 3,
    });
    expect(assessLiquidityRisk({ forecast, currentBalance: "50", next30DaysKnownOutflows: "20" }).level).toBe("HIGH");
  });

  it("nunca recomenda uma poupança automática", () => {
    const forecast = forecastCashBalanceDistribution({
      currentBalance: "1000",
      monthlyNetFlows: ["300", "200", "250", "300", "250", "200"],
      horizonMonths: 3,
    });
    const liquidityRisk = assessLiquidityRisk({ forecast, currentBalance: "1000", next30DaysKnownOutflows: "100" });
    expect(explainableSavingsRecommendation({ forecast, liquidityRisk, emergencyFundGap: "500" }).requiresConfirmation).toBe(true);
  });
});
