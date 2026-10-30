import { describe, expect, it } from "vitest";
import { isFinancialAlertEmailEligible } from "@/lib/finance/financial-alert-email-policy";

describe("financial-alert-email-policy", () => {
  it("inclui CRITICAL, HIGH e SAVINGS_PLAN_*", () => {
    expect(
      isFinancialAlertEmailEligible({ type: "NEGATIVE_PROJECTED_BALANCE", severity: "CRITICAL" }),
    ).toBe(true);
    expect(
      isFinancialAlertEmailEligible({ type: "RECURRING_EXPENSE_OVERDUE", severity: "HIGH" }),
    ).toBe(true);
    expect(
      isFinancialAlertEmailEligible({
        type: "SAVINGS_PLAN_CONTRIBUTION_DUE",
        severity: "ATTENTION",
      }),
    ).toBe(true);
    expect(
      isFinancialAlertEmailEligible({ type: "BUDGET_EXCEEDED", severity: "ATTENTION" }),
    ).toBe(false);
  });
});
