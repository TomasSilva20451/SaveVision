import { describe, expect, it } from "vitest";
import { calculatePatrimonyNet, amortizationPatrimonyImpact } from "@/lib/finance/patrimony";
import type { AccountSnapshot, LedgerMovement } from "@/lib/finance/types";

const accounts: AccountSnapshot[] = [
  {
    id: "a1",
    openingBalance: "20000",
    type: "CURRENT",
    isIncludedInNetWorth: true,
    isArchived: false,
  },
];

describe("patrimony", () => {
  it("TESTE 6: ativos 20k, passivos manuais 5k, PL 15k", () => {
    const result = calculatePatrimonyNet({
      accounts,
      movements: [],
      investmentPositions: [],
      manualLiabilities: [{ outstandingBalance: "5000" }],
    });
    expect(result.netPatrimony).toBe("15000.00");
  });

  it("TESTE 4: objetivo de poupança não altera património (sem movimentos)", () => {
    const before = calculatePatrimonyNet({
      accounts,
      movements: [],
      investmentPositions: [],
      manualLiabilities: [],
    });
    const after = calculatePatrimonyNet({
      accounts,
      movements: [],
      investmentPositions: [],
      manualLiabilities: [],
    });
    expect(before.netPatrimony).toBe(after.netPatrimony);
  });

  it("TESTE 5: posição ligada a conta não duplica valor", () => {
    const withDup = calculatePatrimonyNet({
      accounts: [
        ...accounts,
        {
          id: "inv",
          openingBalance: "1000",
          type: "INVESTMENT",
          isIncludedInNetWorth: true,
          isArchived: false,
        },
      ],
      movements: [],
      investmentPositions: [
        { quantity: "10", manualPrice: "100", linkedAccountId: "inv" },
      ],
      manualLiabilities: [],
    });
    expect(withDup.investmentsValue).toBe("0.00");
    expect(withDup.accountNetWorth).toBe("21000.00");
  });

  it("TESTE 7: amortização capital 500, PL antes de juros inalterado", () => {
    const impact = amortizationPatrimonyImpact("500", "20", "0");
    expect(impact.netWorthImpactFromPrincipal).toBe("0.00");
    expect(impact.expenseFromInterestAndFees).toBe("20.00");
  });
});

describe("transferências", () => {
  it("TESTE 3: transferência não altera património", () => {
    const movements: LedgerMovement[] = [
      { accountId: "a1", type: "TRANSFER", status: "COMPLETED", amount: "-500" },
      { accountId: "a2", type: "TRANSFER", status: "COMPLETED", amount: "500" },
    ];
    const acc: AccountSnapshot[] = [
      { id: "a1", openingBalance: "1000", type: "CURRENT", isIncludedInNetWorth: true, isArchived: false },
      { id: "a2", openingBalance: "200", type: "SAVINGS", isIncludedInNetWorth: true, isArchived: false },
    ];
    const before = calculatePatrimonyNet({ accounts: acc, movements: [], investmentPositions: [], manualLiabilities: [] });
    const after = calculatePatrimonyNet({ accounts: acc, movements, investmentPositions: [], manualLiabilities: [] });
    expect(before.netPatrimony).toBe(after.netPatrimony);
  });
});
