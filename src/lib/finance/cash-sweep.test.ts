import { describe, expect, it } from "vitest";
import { suggestCashSweep } from "@/lib/finance/cash-sweep";

describe("cash-sweep", () => {
  it("sugere montante quando há excedente", () => {
    const suggestion = suggestCashSweep({
      currentAccountBalance: "2000",
      minimumBuffer: "500",
      savingsGoalGap: "1000",
    });
    expect(suggestion?.suggestedAmount).toBe("1000.00");
  });

  it("não sugere sem excedente", () => {
    expect(
      suggestCashSweep({
        currentAccountBalance: "400",
        minimumBuffer: "500",
        savingsGoalGap: "100",
      }),
    ).toBeNull();
  });
});
