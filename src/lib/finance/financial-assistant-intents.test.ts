import { describe, expect, it } from "vitest";
import {
  matchCategoryByName,
  validateAssistantIntent,
} from "@/lib/finance/financial-assistant-intents";

const categories = [
  { id: "c1", name: "Alimentação" },
  { id: "c2", name: "Transportes" },
];

describe("validateAssistantIntent", () => {
  it("aceita expense_total_by_category com período YYYY-MM", () => {
    const validated = validateAssistantIntent({
      intent: "expense_total_by_category",
      parameters: {
        categoryName: "Alimentação",
        period: { kind: "month", yearMonth: "2026-03" },
      },
      confidence: 0.9,
      clarification: null,
    });
    expect(validated?.intent).toBe("expense_total_by_category");
  });

  it("rejeita intent fora da allowlist", () => {
    expect(
      validateAssistantIntent({
        intent: "delete_all_data",
        parameters: {},
        confidence: 0.9,
        clarification: null,
      }),
    ).toBeNull();
  });

  it("rejeita parâmetros inválidos em can_save_monthly", () => {
    expect(
      validateAssistantIntent({
        intent: "can_save_monthly",
        parameters: { amount: -5 },
        confidence: 0.8,
        clarification: null,
      }),
    ).toBeNull();
  });
});

describe("matchCategoryByName", () => {
  it("resolve nome exato em pt-PT", () => {
    expect(matchCategoryByName(categories, "alimentação")?.id).toBe("c1");
  });

  it("devolve null quando há ambiguidade", () => {
    const ambiguous = [
      { id: "a", name: "Supermercado Casa" },
      { id: "b", name: "Casa e jardim" },
    ];
    expect(matchCategoryByName(ambiguous, "casa")).toBeNull();
  });
});
