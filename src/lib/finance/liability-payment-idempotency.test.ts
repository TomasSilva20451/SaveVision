import { describe, expect, it } from "vitest";
import { liabilityPaymentPayloadMatches } from "@/lib/finance/liability-payment-idempotency";

describe("liabilityPaymentPayloadMatches", () => {
  const stored = {
    liabilityId: "l1",
    principalAmount: { toString: () => "450.00" },
    interestAmount: { toString: () => "40.00" },
    feesAmount: { toString: () => "10.00" },
    accountId: "acc1",
  };

  it("aceita retry idêntico", () => {
    expect(
      liabilityPaymentPayloadMatches(stored, {
        liabilityId: "l1",
        principalAmount: "450",
        interestAmount: "40",
        feesAmount: "10",
        accountId: "acc1",
        mode: "WITH_BANK",
      }),
    ).toBe(true);
  });

  it("rejeita mesma chave com montante diferente", () => {
    expect(
      liabilityPaymentPayloadMatches(stored, {
        liabilityId: "l1",
        principalAmount: "500",
        interestAmount: "40",
        feesAmount: "10",
        accountId: "acc1",
        mode: "WITH_BANK",
      }),
    ).toBe(false);
  });
});
