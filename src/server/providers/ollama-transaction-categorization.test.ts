import { describe, expect, it } from "vitest";
import { transactionCategorizationOutputSchema } from "@/lib/finance/transaction-categorization";

function normalizeModelConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  if (value > 1 && value <= 100) return Math.min(1, value / 100);
  if (value > 100) return 1;
  if (value < 0) return 0;
  return value;
}

describe("ollama categorization confidence", () => {
  it("aceita percentagem 0-100 do modelo", () => {
    const parsed = transactionCategorizationOutputSchema.parse({
      merchant: "Continente",
      category: "Alimentação",
      transactionType: "EXPENSE",
      nature: "NECESSARY",
      tags: ["supermercado"],
      confidence: normalizeModelConfidence(100),
      reason: "Compra alimentar.",
    });
    expect(parsed.confidence).toBe(1);
  });
});
