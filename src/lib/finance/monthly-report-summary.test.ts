import { describe, expect, it } from "vitest";
import {
  buildDeterministicMonthlyNarrative,
  computeSavingsRate,
  monthlyReportFactsSchema,
  narrativeMatchesFacts,
} from "@/lib/finance/monthly-report-summary";

const sampleFacts = monthlyReportFactsSchema.parse({
  period: "2026-10",
  periodLabel: "2026-10-01 a 2026-10-21",
  income: "2200.00",
  expenses: "320.50",
  net: "1879.50",
  savingsRate: computeSavingsRate("2200.00", "1879.50"),
  previousMonth: null,
  topCategories: [{ name: "Alimentação", amount: "320.50", sharePercent: "100.00" }],
  budgetExecution: { hasBudget: false, linesOverLimit: 0, topPressure: null },
  goalsHighlight: null,
  activeAlertsCount: 0,
  atypicalExpenses: [],
  upcomingCommitments: [],
  dataQuality: { monthsAvailable: 1, missingCategories: 0, movementCount: 4 },
  limitations: [],
});

describe("monthly report narrative", () => {
  it("calcula taxa de poupança", () => {
    expect(computeSavingsRate("2200.00", "1879.50")).toBe("85.43");
  });

  it("gera texto determinístico com limitação de histórico", () => {
    const text = buildDeterministicMonthlyNarrative(sampleFacts);
    expect(text.replace(/\s/g, "")).toContain("2200,00");
    expect(text).toContain("Alimentação");
    expect(text).toContain("tendência de longo prazo");
  });

  it("valida presença de montantes no texto", () => {
    const text = buildDeterministicMonthlyNarrative(sampleFacts);
    expect(narrativeMatchesFacts(text, sampleFacts)).toBe(true);
  });
});
