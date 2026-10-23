import { describe, expect, it } from "vitest";
import {
  normalizeReceiptExtraction,
  validateReceiptDraft,
  receiptDraftToExpenseDescription,
} from "@/lib/finance/receipt-extraction";

describe("normalizeReceiptExtraction", () => {
  it("normaliza totais com vírgula e itens", () => {
    const draft = normalizeReceiptExtraction({
      merchant: " Continente ",
      date: "2026-10-18",
      total: "34,76",
      currency: "eur",
      items: [{ description: "Leite", amount: "2,10" }],
      confidence: { merchant: 0.95, date: 0.84, total: 0.97 },
    });
    expect(draft.total).toBe("34.76");
    expect(draft.currency).toBe("EUR");
    expect(draft.items[0]?.amount).toBe("2.10");
  });
});

describe("validateReceiptDraft", () => {
  it("exige revisão manual do total", () => {
    const draft = normalizeReceiptExtraction({
      merchant: "Continente",
      date: "2026-10-18",
      total: "34.76",
      confidence: { total: 0.99 },
    });
    const issues = validateReceiptDraft(draft, new Date("2026-10-21T12:00:00Z"));
    expect(issues.some((i) => i.code === "TOTAL_REQUIRES_REVIEW")).toBe(true);
  });

  it("deteta soma de itens inconsistente", () => {
    const draft = normalizeReceiptExtraction({
      merchant: "Continente",
      total: "10.00",
      items: [
        { description: "A", amount: "3.00" },
        { description: "B", amount: "4.00" },
      ],
      confidence: {},
    });
    const issues = validateReceiptDraft(draft, new Date("2026-10-21T12:00:00Z"));
    expect(issues.some((i) => i.code === "ITEMS_SUM_MISMATCH")).toBe(true);
  });
});

describe("receiptDraftToExpenseDescription", () => {
  it("inclui NIF quando existir", () => {
    const draft = normalizeReceiptExtraction({
      merchant: "Continente",
      fiscalNumber: "123456789",
      confidence: {},
    });
    expect(receiptDraftToExpenseDescription(draft)).toContain("NIF 123456789");
  });
});
