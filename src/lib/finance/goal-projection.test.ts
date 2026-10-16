import { describe, expect, it } from "vitest";
import {
  buildGoalScenarios,
  monthlyContributionRequired,
} from "@/lib/finance/goal-projection";

describe("goal-projection", () => {
  it("calcula contribuição mensal para 10k em 24 meses com 2k atuais", () => {
    expect(monthlyContributionRequired("10000", "2000", 24)).toBe("333.33");
  });

  it("gera três cenários", () => {
    const scenarios = buildGoalScenarios({
      targetAmount: "10000",
      currentAmount: "2000",
      monthsRemaining: 24,
      baseMonthlyContribution: "333.33",
      conservativeFactor: "0.8",
      optimisticFactor: "1.2",
    });
    expect(scenarios).toHaveLength(3);
    expect(scenarios[1]?.id).toBe("BASE");
  });
});
