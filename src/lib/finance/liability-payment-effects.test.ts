import { describe, expect, it } from "vitest";
import { calculateAccountBalance, calculateExpenses } from "@/lib/finance/aggregates";
import { calculatePatrimonyNet as patrimonyEngine } from "@/lib/finance/patrimony";
import type { AccountSnapshot, LedgerMovement } from "@/lib/finance/types";

/**
 * Cenário Fase 16.1 — pagamento WITH_BANK:
 * Capital 450, juros 40, encargos 10, saída caixa 500.
 * Implementação: ADJUSTMENT -450, EXPENSE -50.
 */
describe("efeitos pagamento de passivo WITH_BANK", () => {
  const accountId = "bank";
  const openingBalance = "2000";
  const movements: LedgerMovement[] = [
    {
      accountId,
      type: "ADJUSTMENT",
      status: "COMPLETED",
      amount: "-450.00",
    },
    {
      accountId,
      type: "EXPENSE",
      status: "COMPLETED",
      amount: "-50.00",
    },
  ];

  it("saldo bancário final 1 500 €", () => {
    const balance = calculateAccountBalance(openingBalance, movements, accountId);
    expect(balance.toFixed(2)).toBe("1500.00");
  });

  it("despesa económica 50 € (capital excluído)", () => {
    expect(calculateExpenses(movements).toFixed(2)).toBe("50.00");
  });

  it("património líquido varia -50 €", () => {
    const accounts: AccountSnapshot[] = [
      {
        id: accountId,
        openingBalance,
        type: "CURRENT",
        isIncludedInNetWorth: true,
        isArchived: false,
      },
    ];
    const before = patrimonyEngine({
      accounts,
      movements: [],
      investmentPositions: [],
      manualLiabilities: [{ outstandingBalance: "10000" }],
    });
    const after = patrimonyEngine({
      accounts,
      movements,
      investmentPositions: [],
      manualLiabilities: [{ outstandingBalance: "9550" }],
    });
    expect(before.netPatrimony).toBe("-8000.00");
    expect(after.netPatrimony).toBe("-8050.00");
    expect(decimalDelta(before.netPatrimony, after.netPatrimony)).toBe("-50.00");
  });
});

function decimalDelta(before: string, after: string) {
  return (Number(after) - Number(before)).toFixed(2);
}

describe("ADJUSTMENT e agregados", () => {
  it("ADJUSTMENT não entra em calculateExpenses", () => {
    const movements: LedgerMovement[] = [
      { accountId: "a", type: "ADJUSTMENT", status: "COMPLETED", amount: "-450" },
      { accountId: "a", type: "EXPENSE", status: "COMPLETED", amount: "-50" },
    ];
    expect(calculateExpenses(movements).toFixed(2)).toBe("50.00");
  });
});
