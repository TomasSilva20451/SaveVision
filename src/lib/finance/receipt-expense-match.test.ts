import { describe, expect, it } from "vitest";
import { findReceiptDuplicateCandidates } from "@/lib/finance/receipt-expense-match";

describe("receipt-expense-match", () => {
  it("detecta duplicado provável", () => {
    const hits = findReceiptDuplicateCandidates(
      { merchant: "Continente Lisboa", total: "32.50", date: "2026-10-15" },
      [
        {
          id: "t1",
          amount: "-32.50",
          occurredAt: new Date("2026-10-16T12:00:00Z"),
          description: "Continente Lisboa 123",
        },
      ],
    );
    expect(hits[0]?.transactionId).toBe("t1");
    expect(hits[0]?.score).toBeGreaterThanOrEqual(2);
  });

  it("ignora montante diferente", () => {
    const hits = findReceiptDuplicateCandidates(
      { merchant: "Continente", total: "10.00", date: "2026-10-15" },
      [
        {
          id: "t1",
          amount: "-32.50",
          occurredAt: new Date("2026-10-15T12:00:00Z"),
          description: "Continente",
        },
      ],
    );
    expect(hits.length).toBe(0);
  });
});
