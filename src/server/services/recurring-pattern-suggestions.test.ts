import { describe, expect, it } from "vitest";
import { findVerifiedRecurringPattern } from "@/lib/finance/recurring-pattern-detection";

describe("findVerifiedRecurringPattern", () => {
  const transactions = [
    {
      id: "t1",
      occurredAt: new Date("2026-08-17T12:00:00.000Z"),
      amount: "-45.00",
      description: "NET SERV LISBOA",
      categoryId: "cat-1",
      accountId: "acc-1",
    },
    {
      id: "t2",
      occurredAt: new Date("2026-09-17T12:00:00.000Z"),
      amount: "-45.00",
      description: "NET SERV LISBOA",
      categoryId: "cat-1",
      accountId: "acc-1",
    },
    {
      id: "t3",
      occurredAt: new Date("2026-10-17T12:00:00.000Z"),
      amount: "-45.00",
      description: "NET SERV LISBOA",
      categoryId: "cat-1",
      accountId: "acc-1",
    },
  ];

  it("aceita apenas quando a chave e os movimentos coincidem com a deteção", () => {
    const detected = findVerifiedRecurringPattern({
      transactions,
      existingSeries: [],
      suggestionKey: "NET SERV LISBOA|MONTHLY|45.00",
      transactionIds: ["t1", "t2", "t3"],
    });

    expect(detected?.expectedAmount).toBe("45.00");
    expect(detected?.frequency).toBe("MONTHLY");

    expect(
      findVerifiedRecurringPattern({
        transactions,
        existingSeries: [],
        suggestionKey: "NET SERV LISBOA|MONTHLY|45.00",
        transactionIds: ["t1", "t2"],
      }),
    ).toBeNull();

    expect(
      findVerifiedRecurringPattern({
        transactions,
        existingSeries: [],
        suggestionKey: "NET SERV LISBOA|MONTHLY|99.00",
        transactionIds: ["t1", "t2", "t3"],
      }),
    ).toBeNull();
  });
});
