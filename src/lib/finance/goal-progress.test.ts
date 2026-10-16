import { describe, expect, it } from "vitest";
import {
  emergencyFundTargetAmount,
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
});
