import { describe, expect, it } from "vitest";
import {
  detectDuplicateBankLines,
  scoreReconciliationPair,
  suggestReconciliationMatches,
} from "@/lib/finance/bank-reconciliation";

describe("reconciliação bancária", () => {
  it("emparelha montante e data", () => {
    const match = scoreReconciliationPair(
      { id: "b1", amount: "-42.50", bookingDate: new Date("2026-10-10T12:00:00Z"), description: "Continente Lisboa" },
      { id: "t1", amount: "-42.50", occurredAt: new Date("2026-10-11T10:00:00Z"), description: "Continente" },
    );
    expect(match?.transactionId).toBe("t1");
    expect(match?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("sugere apenas um movimento por transação", () => {
    const matches = suggestReconciliationMatches(
      [
        { id: "b1", amount: "10.00", bookingDate: new Date("2026-10-01T00:00:00Z"), description: "Salário" },
        { id: "b2", amount: "-5.00", bookingDate: new Date("2026-10-02T00:00:00Z"), description: "Café" },
      ],
      [
        { id: "t1", amount: "10.00", occurredAt: new Date("2026-10-01T00:00:00Z"), description: "Salário ACME" },
        { id: "t2", amount: "-5.00", occurredAt: new Date("2026-10-02T00:00:00Z"), description: "Café" },
      ],
    );
    expect(matches).toHaveLength(2);
    expect(new Set(matches.map((m) => m.transactionId)).size).toBe(2);
  });

  it("marca linhas duplicadas do extrato", () => {
    const dup = detectDuplicateBankLines([
      { id: "a", externalId: "1", amount: "-1.00", bookingDate: new Date("2026-10-01T00:00:00Z"), counterpartyHash: "x" },
      { id: "b", externalId: "2", amount: "-1.00", bookingDate: new Date("2026-10-01T00:00:00Z"), counterpartyHash: "x" },
    ]);
    expect(dup.get("b")).toBe("a");
  });
});
