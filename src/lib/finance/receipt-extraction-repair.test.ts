import { describe, expect, it } from "vitest";
import {
  parseFlexibleReceiptDate,
  repairReceiptExtractionRaw,
  receiptExtractionNeedsVisionFallback,
  sanitizeFiscalNumber,
  sanitizeMerchantName,
  scoreReceiptExtraction,
} from "@/lib/finance/receipt-extraction-repair";
import { normalizeReceiptExtraction } from "@/lib/finance/receipt-extraction";

describe("receipt repair", () => {
  it("parseia datas em inglês", () => {
    expect(parseFlexibleReceiptDate("October 20, 2026")).toBe("2026-10-20");
  });

  it("remove NIF fantasma e recupera total do merchant", () => {
    const repaired = repairReceiptExtractionRaw({
      merchant: "$34.76 · NIF NIF",
      fiscalNumber: "NIF",
      total: null,
      confidence: {},
    });
    expect(repaired.total).toBe("34.76");
    expect(repaired.merchant).toBeNull();
    expect(repaired.fiscalNumber).toBeNull();
  });

  it("aceita EIN americano", () => {
    expect(sanitizeFiscalNumber("US EIN 87-4436547")).toBe("87-4436547");
  });

  it("rejeita EMITENTE, 4800 e 2008 como implausíveis", () => {
    const bad = repairReceiptExtractionRaw({
      merchant: "EMITENTE",
      date: "2008-10-31",
      total: "4800.00",
      paymentMethod: "cartão",
      confidence: {},
    });
    expect(bad.merchant).toBeNull();
    expect(bad.total).toBeNull();
    expect(bad.date).toBeNull();
    expect(scoreReceiptExtraction({ merchant: "EMITENTE", total: "4800", date: "2008-10-31", confidence: {} })).toBeLessThan(
      6,
    );
  });

  it("normaliza fatura Cursor típica após reparação", () => {
    const draft = normalizeReceiptExtraction({
      merchant: "Cursor",
      date: "October 20, 2026",
      total: "24.60",
      currency: "USD",
      fiscalNumber: "87-4436547",
      vatAmount: "4.60",
      items: [{ description: "Cursor Pro", amount: "20.00" }],
      confidence: { merchant: 0.9, total: 0.95, date: 0.9 },
    });
    expect(draft.merchant).toBe("Cursor");
    expect(draft.date).toBe("2026-10-20");
    expect(draft.total).toBe("24.60");
    expect(draft.currency).toBe("USD");
    expect(sanitizeMerchantName(draft.merchant)).toBe("Cursor");
    expect(receiptExtractionNeedsVisionFallback({ merchant: "Cursor", total: "24.60", confidence: {} })).toBe(
      false,
    );
  });
});
