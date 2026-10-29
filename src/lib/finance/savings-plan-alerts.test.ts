import { describe, expect, it } from "vitest";
import { evaluateSavingsPlanAlertCandidates } from "@/lib/finance/savings-plan-alerts";

describe("savings-plan-alerts", () => {
  it("deduplica alertas de saída por transacção", () => {
    const asOf = new Date("2026-11-10T12:00:00.000Z");
    const candidates = evaluateSavingsPlanAlertCandidates({
      workspaceId: "ws1",
      asOf,
      civilYear: 2026,
      civilMonth: 11,
      plans: [
        {
          planId: "p1",
          planName: "Desafio",
          goalId: "g1",
          savingsAccountId: "acc1",
          status: "ACTIVE",
          alertThresholdPercent: 75,
          targetAmount: "300.00",
          targetDateIso: "2027-01-20",
          contributionAmounts: [],
          budgetRules: [],
        },
      ],
      checkIns: [],
      budgetLinesByCategory: new Map(),
      withdrawals: [
        {
          planId: "p1",
          transactionId: "tx1",
          amount: "-10.00",
          occurredAt: asOf,
          description: "Teste",
          accountName: "Poupança 300",
        },
      ],
    });
    const keys = candidates.map((c) => c.deduplicationKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(candidates.some((c) => c.type === "SAVINGS_PLAN_ACCOUNT_WITHDRAWAL")).toBe(true);
  });
});
