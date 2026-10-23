import { describe, expect, it } from "vitest";
import {
  detectCategoryMedian3xAnomaly,
  detectFirstHighExpenseAnomaly,
  detectMonthOverMonthSpike,
} from "@/lib/finance/expense-anomaly-detection";

describe("expense-anomaly-detection", () => {
  it("R1 mediana 3x", () => {
    const hit = detectCategoryMedian3xAnomaly({
      categoryId: "c1",
      categoryName: "Alimentação",
      monthTotal: "300.00",
      historyTotals: ["10", "12", "11", "10", "13"],
    });
    expect(hit?.ruleId).toBe("R1_median_3x");
  });

  it("R2 primeira despesa alta", () => {
    const hit = detectFirstHighExpenseAnomaly({
      transactionId: "t1",
      categoryName: "Viagens",
      amount: "-200.00",
      priorCountInCategory: 0,
    });
    expect(hit?.ruleId).toBe("R2_first_high");
  });

  it("R3 spike MoM", () => {
    const hit = detectMonthOverMonthSpike({
      categoryId: "c1",
      categoryName: "Lazer",
      currentTotal: "200.00",
      previousTotal: "80.00",
    });
    expect(hit?.ruleId).toBe("R3_mom_spike");
  });
});
