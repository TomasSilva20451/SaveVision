import { describe, expect, it } from "vitest";
import {
  emergencyFundTargetAmount,
  goalFundingSnapshot,
  goalProgressPercent,
  sumContributions,
} from "@/lib/finance/goal-progress";

describe("goal-progress", () => {
  it("soma contribuições", () => {
    expect(sumContributions(["100", "50.5"]).toString()).toBe("150.5");
  });

  it("calcula percentagem até 100", () => {
    expect(goalProgressPercent("250", "1000")).toBe(25);
    expect(goalProgressPercent("1500", "1000")).toBe(100);
  });

  it("fundo de emergência por meses", () => {
    expect(emergencyFundTargetAmount("800", 6)).toBe("4800.00");
  });

  it("usa o saldo real da conta associada sem apagar o histórico", () => {
    expect(goalFundingSnapshot(["25", "25", "20"], "56.37")).toEqual({
      currentAmount: "56.37",
      recordedContributions: "70.00",
      netWithdrawn: "13.63",
      usesLinkedAccountBalance: true,
    });
  });

  it("mantém as contribuições como fonte quando não há conta associada", () => {
    expect(goalFundingSnapshot(["25", "25"])).toEqual({
      currentAmount: "50.00",
      recordedContributions: "50.00",
      netWithdrawn: "0.00",
      usesLinkedAccountBalance: false,
    });
  });
});
