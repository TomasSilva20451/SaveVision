import { describe, expect, it } from "vitest";
import {
  normalizeCategorizationPattern,
  patternForConfirmedSuggestion,
  transactionCategorizationOutputSchema,
} from "@/lib/finance/transaction-categorization";

describe("transaction categorization validation", () => {
  it("normaliza referências bancárias sem guardar identificadores numéricos", () => {
    expect(normalizeCategorizationPattern("CONTINENTE MODELO 0182 Lisboa")).toBe(
      "CONTINENTE MODELO LISBOA",
    );
    expect(patternForConfirmedSuggestion("CONTINENTE MODELO 0182", "Continente")).toBe(
      "CONTINENTE",
    );
  });

  it("usa a descrição quando o comerciante sugerido não existe no texto", () => {
    expect(patternForConfirmedSuggestion("Pagamento loja local 492", "Comerciante inventado")).toBe(
      "LOJA LOCAL",
    );
  });

  it("rejeita confiança inválida e campos inesperados", () => {
    const base = {
      merchant: "Continente",
      category: "Alimentação",
      transactionType: "EXPENSE",
      nature: "NECESSARY",
      tags: ["supermercado"],
      confidence: 0.96,
      reason: "Cadeia de supermercados.",
    };

    expect(transactionCategorizationOutputSchema.safeParse(base).success).toBe(true);
    expect(transactionCategorizationOutputSchema.safeParse({ ...base, confidence: 1.2 }).success).toBe(false);
    expect(transactionCategorizationOutputSchema.safeParse({ ...base, databaseId: "unsafe" }).success).toBe(false);
  });
});
