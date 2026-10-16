import { describe, expect, it } from "vitest";
import {
  calculateAccountBalance,
  calculateExpectedIncome,
  calculateIncome,
} from "@/lib/finance/aggregates";
import type { LedgerMovement } from "@/lib/finance/types";

const accountId = "acc-1";

describe("regressão financeira (cenários 1 a 5)", () => {
  it("TESTE 1: receita EXPECTED não altera saldo nem receitas realizadas", () => {
    const movements: LedgerMovement[] = [
      {
        accountId,
        type: "INCOME",
        status: "EXPECTED",
        amount: "100",
      },
    ];
    expect(calculateAccountBalance("1000", movements, accountId).toFixed(2)).toBe(
      "1000.00",
    );
    expect(calculateIncome(movements).toFixed(2)).toBe("0.00");
    expect(calculateExpectedIncome(movements).toFixed(2)).toBe("100.00");
  });

  it("TESTE 2: receita COMPLETED aumenta saldo", () => {
    const movements: LedgerMovement[] = [
      {
        accountId,
        type: "INCOME",
        status: "COMPLETED",
        amount: "100",
      },
    ];
    expect(calculateAccountBalance("1000", movements, accountId).toFixed(2)).toBe(
      "1100.00",
    );
  });

  it("TESTE 3: duplicar movimento COMPLETED duplicaria saldo (serviço impede na confirmação)", () => {
    const single: LedgerMovement[] = [
      {
        accountId,
        type: "INCOME",
        status: "COMPLETED",
        amount: "100",
      },
    ];
    const duplicated: LedgerMovement[] = [...single, ...single];
    expect(calculateAccountBalance("1000", single, accountId).toFixed(2)).toBe(
      "1100.00",
    );
    expect(calculateAccountBalance("1000", duplicated, accountId).toFixed(2)).toBe(
      "1200.00",
    );
  });

  it("TESTE 8: receita esperada de 1000 € não aumenta saldo disponível", () => {
    const movements: LedgerMovement[] = [
      {
        accountId,
        type: "INCOME",
        status: "EXPECTED",
        amount: "1000",
      },
    ];
    expect(calculateAccountBalance("500", movements, accountId).toFixed(2)).toBe(
      "500.00",
    );
    expect(calculateIncome(movements).toFixed(2)).toBe("0.00");
  });

  it("TESTE 5: despesa de 50 € reduz saldo em 50 €", () => {
    const movements: LedgerMovement[] = [
      {
        accountId,
        type: "EXPENSE",
        status: "COMPLETED",
        amount: "-50",
      },
    ];
    expect(calculateAccountBalance("1000", movements, accountId).toFixed(2)).toBe(
      "950.00",
    );
  });
});
