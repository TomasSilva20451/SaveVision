import { describe, expect, it } from "vitest";
import {
  budgetAvailable,
  budgetOverage,
  budgetUtilizationPercent,
} from "@/lib/finance/budget";

describe("budget", () => {
  it("TESTE 1: 300 € orçamento, 180 € despesa, 120 € disponível", () => {
    expect(budgetAvailable("300", "180")).toBe("120.00");
    expect(budgetUtilizationPercent("300", "180")).toBe(60);
  });

  it("TESTE 2: excesso de 50 €", () => {
    expect(budgetOverage("300", "350")).toBe("50.00");
    expect(budgetUtilizationPercent("300", "350")).toBe(116.7);
  });
});
