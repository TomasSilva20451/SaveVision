import { describe, expect, it } from "vitest";
import { calculatePatrimonyNet } from "@/lib/finance/patrimony";
import type { AccountSnapshot, LedgerMovement } from "@/lib/finance/types";

describe("invariantes patrimoniais (Fase 16)", () => {
  it("CASO A: contas 5k + 3k => PL 8k", () => {
    const accounts: AccountSnapshot[] = [
      {
        id: "c",
        openingBalance: "5000",
        type: "CURRENT",
        isIncludedInNetWorth: true,
        isArchived: false,
      },
      {
        id: "s",
        openingBalance: "3000",
        type: "SAVINGS",
        isIncludedInNetWorth: true,
        isArchived: false,
      },
    ];
    const result = calculatePatrimonyNet({
      accounts,
      movements: [],
      investmentPositions: [],
      manualLiabilities: [],
    });
    expect(result.netPatrimony).toBe("8000.00");
  });

  it("CASO B: transferência interna neutra", () => {
    const accounts: AccountSnapshot[] = [
      {
        id: "c",
        openingBalance: "5000",
        type: "CURRENT",
        isIncludedInNetWorth: true,
        isArchived: false,
      },
      {
        id: "s",
        openingBalance: "3000",
        type: "SAVINGS",
        isIncludedInNetWorth: true,
        isArchived: false,
      },
    ];
    const movements: LedgerMovement[] = [
      { accountId: "c", type: "TRANSFER", status: "COMPLETED", amount: "-1000" },
      { accountId: "s", type: "TRANSFER", status: "COMPLETED", amount: "1000" },
    ];
    const before = calculatePatrimonyNet({
      accounts,
      movements: [],
      investmentPositions: [],
      manualLiabilities: [],
    });
    const after = calculatePatrimonyNet({
      accounts,
      movements,
      investmentPositions: [],
      manualLiabilities: [],
    });
    expect(before.netPatrimony).toBe("8000.00");
    expect(after.netPatrimony).toBe("8000.00");
  });

  it("CASO D: investimento standalone 2k", () => {
    const result = calculatePatrimonyNet({
      accounts: [
        {
          id: "c",
          openingBalance: "8000",
          type: "CURRENT",
          isIncludedInNetWorth: true,
          isArchived: false,
        },
      ],
      movements: [],
      investmentPositions: [
        { quantity: "20", manualPrice: "100", valuationMode: "STANDALONE" },
      ],
      manualLiabilities: [],
    });
    expect(result.netPatrimony).toBe("10000.00");
  });

  it("CASO E: ACCOUNT_COMPONENT não duplica", () => {
    const result = calculatePatrimonyNet({
      accounts: [
        {
          id: "broker",
          openingBalance: "2000",
          type: "INVESTMENT",
          isIncludedInNetWorth: true,
          isArchived: false,
        },
      ],
      movements: [],
      investmentPositions: [
        {
          quantity: "20",
          manualPrice: "100",
          valuationMode: "ACCOUNT_COMPONENT",
          linkedAccountId: "broker",
        },
      ],
      manualLiabilities: [],
    });
    expect(result.investmentsValue).toBe("0.00");
    expect(result.netPatrimony).toBe("2000.00");
  });

  it("CASO F: ativos 10k, passivo 3k => PL 7k", () => {
    const result = calculatePatrimonyNet({
      accounts: [
        {
          id: "c",
          openingBalance: "10000",
          type: "CURRENT",
          isIncludedInNetWorth: true,
          isArchived: false,
        },
      ],
      movements: [],
      investmentPositions: [],
      manualLiabilities: [{ outstandingBalance: "3000" }],
    });
    expect(result.netPatrimony).toBe("7000.00");
  });
});
