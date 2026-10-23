import { describe, expect, it } from "vitest";
import {
  detectRecurringPatterns,
  isRetailLikeMerchant,
  recurringSeriesMatchesPattern,
} from "@/lib/finance/recurring-pattern-detection";

function expense(id: string, iso: string, amount: string, description: string) {
  return {
    id,
    occurredAt: new Date(`${iso}T12:00:00.000Z`),
    amount,
    description,
    categoryId: "cat-1",
    accountId: "acc-1",
  };
}

describe("recurring pattern detection", () => {
  it("deteta uma recorrência mensal com três movimentos semelhantes", () => {
    const patterns = detectRecurringPatterns({
      now: new Date("2026-10-21T12:00:00.000Z"),
      transactions: [
        expense("t1", "2026-08-17", "-45.00", "NET SERV LISBOA"),
        expense("t2", "2026-09-17", "-45.00", "NET SERV LISBOA"),
        expense("t3", "2026-10-17", "-45.00", "NET SERV LISBOA"),
      ],
    });

    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.frequency).toBe("MONTHLY");
    expect(patterns[0]?.expectedAmount).toBe("45.00");
    expect(patterns[0]?.transactionIds).toEqual(["t1", "t2", "t3"]);
    expect(patterns[0]?.confidence).toBeGreaterThan(0.55);
  });

  it("ignora compras repetidas em supermercado", () => {
    const patterns = detectRecurringPatterns({
      now: new Date("2026-10-21T12:00:00.000Z"),
      transactions: [
        expense("s1", "2026-08-05", "-84.32", "CONTINENTE MODELO 0182 LISBOA"),
        expense("s2", "2026-09-05", "-86.10", "CONTINENTE MODELO 0182 LISBOA"),
        expense("s3", "2026-10-05", "-83.90", "CONTINENTE MODELO 0182 LISBOA"),
      ],
    });

    expect(patterns).toHaveLength(0);
    expect(isRetailLikeMerchant("CONTINENTE MODELO LISBOA")).toBe(true);
  });

  it("não sugere quando já existe uma recorrência equivalente", () => {
    const candidate = detectRecurringPatterns({
      now: new Date("2026-10-21T12:00:00.000Z"),
      transactions: [
        expense("t1", "2026-08-17", "-45.00", "NET SERV LISBOA"),
        expense("t2", "2026-09-17", "-45.00", "NET SERV LISBOA"),
        expense("t3", "2026-10-17", "-45.00", "NET SERV LISBOA"),
      ],
    })[0]!;

    expect(
      recurringSeriesMatchesPattern(
        { name: "Internet NET SERV", expectedAmount: "45.00", frequency: "MONTHLY", status: "ACTIVE" },
        candidate,
      ),
    ).toBe(true);

    const patterns = detectRecurringPatterns({
      now: new Date("2026-10-21T12:00:00.000Z"),
      transactions: [
        expense("t1", "2026-08-17", "-45.00", "NET SERV LISBOA"),
        expense("t2", "2026-09-17", "-45.00", "NET SERV LISBOA"),
        expense("t3", "2026-10-17", "-45.00", "NET SERV LISBOA"),
      ],
      existingSeries: [
        { name: "Internet NET SERV", expectedAmount: "45.00", frequency: "MONTHLY", status: "ACTIVE" },
      ],
    });

    expect(patterns).toHaveLength(0);
  });
});
