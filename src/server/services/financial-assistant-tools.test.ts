import { describe, expect, it } from "vitest";
import { formatAssistantAnswer } from "@/lib/finance/financial-assistant-format";

describe("formatAssistantAnswer", () => {
  it("formata poupança mensal viável", () => {
    const text = formatAssistantAnswer(
      { intent: "can_save_monthly", parameters: { amount: 300 } },
      {
        summaryKey: "can_save_monthly",
        facts: { requested: "300.00", averageNet: "450.00", feasible: true },
      },
    );
    expect(text).toContain("300");
    expect(text).toContain("compatível");
  });

  it("formata taxa de poupança com percentagem", () => {
    const text = formatAssistantAnswer(
      { intent: "savings_rate", parameters: {} },
      {
        summaryKey: "savings_rate",
        facts: {
          income: "2000.00",
          expenses: "1500.00",
          net: "500.00",
          savingsRatePercent: "25.0",
          periodLabel: "2026-03",
        },
      },
    );
    expect(text).toContain("25.0%");
  });
});
