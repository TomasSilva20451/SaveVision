import { describe, expect, it } from "vitest";
import {
  calculateAccountBalance,
  calculateCashFlow,
  calculateNetCashMovement,
  calculateExpectedIncome,
  calculateExpenses,
  calculateIncome,
  calculateNetWorth,
} from "@/lib/finance/aggregates";
import type { AccountSnapshot, LedgerMovement } from "@/lib/finance/types";

const currentId = "acc-current";
const savingsId = "acc-savings";

const accounts: AccountSnapshot[] = [
  {
    id: currentId,
    openingBalance: "1000",
    type: "CURRENT",
    isIncludedInNetWorth: true,
    isArchived: false,
  },
  {
    id: savingsId,
    openingBalance: "200",
    type: "SAVINGS",
    isIncludedInNetWorth: true,
    isArchived: false,
  },
];

describe("motor financeiro", () => {
  it("não conta transferência como receita nem despesa", () => {
    const movements: LedgerMovement[] = [
      {
        accountId: currentId,
        type: "TRANSFER",
        status: "COMPLETED",
        amount: "-500",
      },
      {
        accountId: savingsId,
        type: "TRANSFER",
        status: "COMPLETED",
        amount: "500",
      },
    ];

    expect(calculateIncome(movements).toFixed(2)).toBe("0.00");
    expect(calculateExpenses(movements).toFixed(2)).toBe("0.00");
    expect(calculateCashFlow(movements).toFixed(2)).toBe("0.00");
  });

  it("move 500 € da conta à ordem para poupança sem alterar património", () => {
    const movements: LedgerMovement[] = [
      {
        accountId: currentId,
        type: "TRANSFER",
        status: "COMPLETED",
        amount: "-500",
      },
      {
        accountId: savingsId,
        type: "TRANSFER",
        status: "COMPLETED",
        amount: "500",
      },
    ];

    const netBefore = calculateNetWorth(accounts, []);
    const netAfter = calculateNetWorth(accounts, movements);

    expect(calculateAccountBalance("1000", movements, currentId).toFixed(2)).toBe(
      "500.00",
    );
    expect(calculateAccountBalance("200", movements, savingsId).toFixed(2)).toBe(
      "700.00",
    );
    expect(netBefore.toFixed(2)).toBe("1200.00");
    expect(netAfter.toFixed(2)).toBe("1200.00");
  });

  it("ignora receitas EXPECTED no saldo e nas receitas realizadas", () => {
    const movements: LedgerMovement[] = [
      {
        accountId: currentId,
        type: "INCOME",
        status: "EXPECTED",
        amount: "300",
      },
      {
        accountId: currentId,
        type: "INCOME",
        status: "COMPLETED",
        amount: "100",
      },
    ];

    expect(calculateIncome(movements).toFixed(2)).toBe("100.00");
    expect(calculateExpectedIncome(movements).toFixed(2)).toBe("300.00");
    expect(
      calculateAccountBalance("1000", movements, currentId).toFixed(2),
    ).toBe("1100.00");
  });

  it("soma receitas e despesas externas no cash flow", () => {
    const movements: LedgerMovement[] = [
      {
        accountId: currentId,
        type: "INCOME",
        status: "COMPLETED",
        amount: "300",
      },
      {
        accountId: currentId,
        type: "EXPENSE",
        status: "COMPLETED",
        amount: "-80",
      },
    ];

    expect(calculateIncome(movements).toFixed(2)).toBe("300.00");
    expect(calculateExpenses(movements).toFixed(2)).toBe("80.00");
    expect(calculateCashFlow(movements).toFixed(2)).toBe("220.00");
  });

  it("movimento de caixa inclui amortização ADJUSTMENT", () => {
    const movements: LedgerMovement[] = [
      {
        accountId: currentId,
        type: "EXPENSE",
        status: "COMPLETED",
        amount: "-50",
      },
      {
        accountId: currentId,
        type: "ADJUSTMENT",
        status: "COMPLETED",
        amount: "-450",
      },
    ];
    expect(calculateCashFlow(movements).toFixed(2)).toBe("-50.00");
    expect(calculateNetCashMovement(movements).toFixed(2)).toBe("-500.00");
  });
});
