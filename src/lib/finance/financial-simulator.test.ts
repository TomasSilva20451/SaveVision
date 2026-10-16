import { describe, expect, it } from "vitest";
import {
  estimateFixedInstallment,
  simulateCarPurchase,
  simulateCashflowDelta,
  simulateEmergencyFund,
  simulateExtraLoanAmortization,
  simulateMonthlySavings,
  simulateOneOffExpense,
  simulateExpenseReduction,
  compareScenarioRows,
} from "@/lib/finance/financial-simulator";

describe("financial-simulator", () => {
  it("poupança sem rendimento: 2000 + 200×24 = 6800", () => {
    const r = simulateMonthlySavings({
      initialBalance: "2000",
      monthlyContribution: "200",
      horizonMonths: 24,
      annualRatePercent: "0",
    });
    expect(r.finalBalance).toBe("6800.00");
    expect(r.simulatedInterest).toBe("0.00");
  });

  it("fundo de emergência: 20 meses para 6000 € a 300 €/mês", () => {
    const r = simulateEmergencyFund({
      currentReserve: "3000",
      monthlyEssentialExpenses: "1500",
      targetMonths: 6,
      monthlyContribution: "300",
    });
    expect(r.targetAmount).toBe("9000.00");
    expect(r.gap).toBe("6000.00");
    expect(r.monthsToTarget).toBe(20);
  });

  it("prestação fixa com taxa zero divide capital", () => {
    expect(estimateFixedInstallment("15000", 60, "0")).toBe("250.00");
  });

  it("compra automóvel calcula entrada + prestação", () => {
    const r = simulateCarPurchase({
      price: "20000",
      downPayment: "5000",
      financedPrincipal: "15000",
      termMonths: 60,
      annualInterestRatePercent: "5",
    });
    expect(r.cashNeededAtPurchase).toBe("5000.00");
    expect(decimalGt(r.estimatedMonthlyPayment, "250"));
  });

  it("variação rendimento +10%", () => {
    const r = simulateCashflowDelta({
      baseMonthlyIncome: "2000",
      baseMonthlyExpense: "1500",
      incomeDelta: "200",
      expenseDelta: "0",
      months: 12,
      startingBalance: "1000",
    });
    expect(r.monthlyNet).toBe("700.00");
    expect(r.finalBalance).toBe("9400.00");
  });

  it("despesa extraordinária reduz saldo", () => {
    const r = simulateOneOffExpense({
      startingBalance: "5000",
      expenseAmount: "2000",
      atMonthIndex: 1,
      horizonMonths: 6,
    });
    expect(r.balanceAfter).toBe("3000.00");
  });

  it("amortização extraordinária poupa juros simulados", () => {
    const r = simulateExtraLoanAmortization({
      outstandingPrincipal: "100000",
      annualInterestRatePercent: "3",
      remainingTermMonths: 240,
      currentMonthlyPayment: "554",
      extraPrincipalPayment: "5000",
      policy: "REDUCE_TERM",
    });
    expect(Number(r.interestSaved)).toBeGreaterThan(0);
  });

  it("redução de despesas 10%", () => {
    const r = simulateExpenseReduction({
      currentMonthlyExpense: "450",
      reductionPercent: 10,
    });
    expect(r.newMonthlyExpense).toBe("405.00");
    expect(r.monthlySavings).toBe("45.00");
  });

  it("comparação BASE/A", () => {
    const c = compareScenarioRows([
      { label: "BASE", finalBalance: "1000", minBalance: "800" },
      { label: "A", finalBalance: "1200", minBalance: "900" },
    ]);
    expect(c.deltas[0]?.finalDelta).toBe("200.00");
  });

  it("rejeita contribuição negativa", () => {
    expect(() =>
      simulateMonthlySavings({
        initialBalance: "0",
        monthlyContribution: "-1",
        horizonMonths: 12,
      }),
    ).toThrow("INVALID_CONTRIBUTION");
  });
});

function decimalGt(a: string, b: string): boolean {
  return Number(a) > Number(b);
}
