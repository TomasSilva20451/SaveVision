import { describe, expect, it } from "vitest";
import {
  buildDeterministicExplanation,
  evidenceRecordToLines,
  type StructuredExplanationPayload,
} from "@/lib/finance/natural-language-explanation";

describe("natural language explanation", () => {
  it("converte evidência de orçamento em linhas legíveis", () => {
    const lines = evidenceRecordToLines({
      categoryName: "Alimentação",
      limit: "200.00",
      spent: "320.50",
      overage: "120.50",
    });
    expect(lines.some((line) => line.includes("Alimentação"))).toBe(true);
  });

  it("gera fallback factual sem sugestão", () => {
    const payload: StructuredExplanationPayload = {
      kind: "alert",
      subjectType: "BUDGET_EXCEEDED",
      severity: "ATTENTION",
      severityGuide: "Atenção",
      title: "Orçamento ultrapassado",
      officialSummary: "Limite excedido em 120,50 €.",
      evidenceLines: ["limit: 200", "spent: 320.50"],
      topMovements: [{ date: "17", description: "Supermercado", amount: "120.00" }],
      comparisonNote: "Mês anterior: 280 €",
      availableUserActions: ["Ver orçamento"],
      engineActionLabel: "Ver orçamento",
      dataIncomplete: false,
    };
    const result = buildDeterministicExplanation(payload);
    expect(result.optionalSuggestion).toBeNull();
    expect(result.factualExplanation).toContain("120.00");
  });
});
