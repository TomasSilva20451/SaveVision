import { decimal } from "@/lib/finance/money";
import { emergencyFundTargetAmount } from "@/lib/finance/goal-progress";

/** Horizontes de poupança suportados (meses). */
export const SIMULATION_SAVINGS_HORIZONS = [12, 24, 36, 60, 120] as const;

export type SavingsHorizonMonths = (typeof SIMULATION_SAVINGS_HORIZONS)[number];

export type MonthlySavingsInput = {
  initialBalance: string;
  monthlyContribution: string;
  horizonMonths: number;
  /** Taxa anual nominal (%), ex.: "2.5". Contribuições no fim de cada mês. */
  annualRatePercent?: string;
};

export type MonthlySavingsResult = {
  finalBalance: string;
  totalContributions: string;
  simulatedInterest: string;
  months: number;
  monthlySeries: { monthIndex: number; balance: string }[];
};

export function simulateMonthlySavings(input: MonthlySavingsInput): MonthlySavingsResult {
  const months = Math.max(0, Math.min(120, Math.floor(input.horizonMonths)));
  const contribution = decimal(input.monthlyContribution);
  if (contribution.lt(0)) {
    throw new Error("INVALID_CONTRIBUTION");
  }
  let balance = decimal(input.initialBalance);
  if (balance.lt(0)) {
    throw new Error("INVALID_INITIAL_BALANCE");
  }

  const rateAnnual = decimal(input.annualRatePercent ?? "0");
  if (rateAnnual.lt(0)) {
    throw new Error("INVALID_RATE");
  }
  const r = rateAnnual.div(100).div(12);

  const series: MonthlySavingsResult["monthlySeries"] = [];
  let contributed = decimal(0);

  for (let m = 1; m <= months; m += 1) {
    if (r.gt(0)) {
      balance = balance.times(r.plus(1));
    }
    balance = balance.plus(contribution);
    contributed = contributed.plus(contribution);
    series.push({ monthIndex: m, balance: balance.toFixed(2) });
  }

  const finalBalance = balance.toFixed(2);
  const totalContributions = contributed.toFixed(2);
  const simulatedInterest = balance.minus(decimal(input.initialBalance)).minus(contributed).toFixed(2);

  return {
    finalBalance,
    totalContributions,
    simulatedInterest,
    months,
    monthlySeries: series,
  };
}

export type EmergencyFundSimulationInput = {
  currentReserve: string;
  monthlyEssentialExpenses: string;
  targetMonths: number;
  monthlyContribution: string;
};

export type EmergencyFundSimulationResult = {
  targetAmount: string;
  gap: string;
  monthsToTarget: number | null;
  projectedReserveAfterHorizon: string;
};

export function simulateEmergencyFund(
  input: EmergencyFundSimulationInput,
): EmergencyFundSimulationResult {
  const target = decimal(
    emergencyFundTargetAmount(input.monthlyEssentialExpenses, input.targetMonths),
  );
  const current = decimal(input.currentReserve);
  const monthly = decimal(input.monthlyContribution);
  if (monthly.lt(0) || current.lt(0)) {
    throw new Error("INVALID_EMERGENCY_INPUT");
  }

  const gap = target.minus(current);
  const gapStr = gap.gt(0) ? gap.toFixed(2) : "0.00";

  let monthsToTarget: number | null = null;
  if (gap.lte(0)) {
    monthsToTarget = 0;
  } else if (monthly.gt(0)) {
    monthsToTarget = Math.ceil(gap.div(monthly).toNumber());
  }

  const horizon = monthsToTarget ?? 0;
  const projected =
    horizon > 0 && monthly.gt(0)
      ? current.plus(monthly.times(horizon)).toFixed(2)
      : current.toFixed(2);

  return {
    targetAmount: target.toFixed(2),
    gap: gapStr,
    monthsToTarget,
    projectedReserveAfterHorizon: projected,
  };
}

export type CarPurchaseInput = {
  price: string;
  downPayment: string;
  financedPrincipal: string;
  termMonths: number;
  annualInterestRatePercent: string;
  monthlyInsurance?: string;
  monthlyMaintenance?: string;
  monthlyFuel?: string;
  upfrontFees?: string;
};

export type CarPurchaseResult = {
  cashNeededAtPurchase: string;
  estimatedMonthlyPayment: string;
  totalInterestEstimated: string;
  totalCostEstimated: string;
  monthlyAllInEstimate: string;
  limitations: string[];
};

/** Prestação fixa (sistema francês), taxa mensal explícita. */
export function estimateFixedInstallment(
  principal: string,
  termMonths: number,
  annualInterestRatePercent: string,
): string {
  const p = decimal(principal);
  const n = Math.max(1, Math.floor(termMonths));
  const annual = decimal(annualInterestRatePercent);
  if (p.lte(0)) return "0.00";
  if (annual.lte(0)) {
    return p.div(n).toFixed(2);
  }
  const r = annual.div(100).div(12);
  const onePlusR = r.plus(1);
  const pow = onePlusR.pow(n);
  const payment = p.times(r.times(pow)).div(pow.minus(1));
  return payment.toFixed(2);
}

export function simulateCarPurchase(input: CarPurchaseInput): CarPurchaseResult {
  const price = decimal(input.price);
  const down = decimal(input.downPayment);
  const financed = decimal(input.financedPrincipal);
  const limitations: string[] = [];

  if (price.lt(0) || down.lt(0) || financed.lt(0)) {
    throw new Error("INVALID_CAR_INPUT");
  }

  if (!down.plus(financed).eq(price)) {
    limitations.push(
      "Entrada + financiamento não coincide com o preço; valores tratados como introduzidos.",
    );
  }

  const fees = decimal(input.upfrontFees ?? "0");
  const payment = estimateFixedInstallment(
    financed.toFixed(2),
    input.termMonths,
    input.annualInterestRatePercent,
  );
  const paymentDec = decimal(payment);
  const totalPaid = paymentDec.times(input.termMonths);
  const interest = totalPaid.minus(financed);

  const insurance = decimal(input.monthlyInsurance ?? "0");
  const maint = decimal(input.monthlyMaintenance ?? "0");
  const fuel = decimal(input.monthlyFuel ?? "0");
  if (insurance.eq(0) && maint.eq(0) && fuel.eq(0)) {
    limitations.push("Seguro, manutenção e combustível não foram indicados.");
  }

  const allIn = paymentDec.plus(insurance).plus(maint).plus(fuel);
  const totalCost = down.plus(totalPaid).plus(fees).plus(insurance.plus(maint).plus(fuel).times(input.termMonths));

  return {
    cashNeededAtPurchase: down.plus(fees).toFixed(2),
    estimatedMonthlyPayment: payment,
    totalInterestEstimated: interest.gt(0) ? interest.toFixed(2) : "0.00",
    totalCostEstimated: totalCost.toFixed(2),
    monthlyAllInEstimate: allIn.toFixed(2),
    limitations,
  };
}

export type LoanAmortizationInput = {
  outstandingPrincipal: string;
  annualInterestRatePercent: string;
  remainingTermMonths: number;
  currentMonthlyPayment: string;
  extraPrincipalPayment: string;
  extraPaymentFee?: string;
  /** REDUCE_TERM | REDUCE_PAYMENT — apenas simulação; não altera passivo real. */
  policy: "REDUCE_TERM" | "REDUCE_PAYMENT";
};

export type LoanAmortizationResult = {
  baselineInterestRemaining: string;
  scenarioInterestRemaining: string;
  interestSaved: string;
  newTermMonths: number | null;
  newMonthlyPayment: string | null;
  liquidityImpactNow: string;
  limitations: string[];
};

export function simulateExtraLoanAmortization(
  input: LoanAmortizationInput,
): LoanAmortizationResult {
  const principal = decimal(input.outstandingPrincipal);
  const extra = decimal(input.extraPrincipalPayment);
  const fee = decimal(input.extraPaymentFee ?? "0");
  const limitations: string[] = [];

  if (principal.lte(0) || extra.lt(0)) {
    throw new Error("INVALID_LOAN_INPUT");
  }
  if (extra.gt(principal)) {
    limitations.push("Amortização extraordinária superior ao capital em dívida (cap simulado).");
  }

  const effectiveExtra = extra.gt(principal) ? principal : extra;
  const newPrincipal = principal.minus(effectiveExtra);
  const n = Math.max(1, Math.floor(input.remainingTermMonths));
  const rate = input.annualInterestRatePercent;

  const baselineInterest = estimateTotalInterest(
    principal.toFixed(2),
    n,
    rate,
    input.currentMonthlyPayment,
  );
  const liquidityImpactNow = effectiveExtra.plus(fee).toFixed(2);

  let newTermMonths: number | null = n;
  let newPayment: string | null = input.currentMonthlyPayment;

  if (input.policy === "REDUCE_TERM") {
    newPayment = input.currentMonthlyPayment;
    newTermMonths = estimateRemainingMonths(
      newPrincipal.toFixed(2),
      rate,
      input.currentMonthlyPayment,
    );
  } else {
    newTermMonths = n;
    newPayment = estimateFixedInstallment(newPrincipal.toFixed(2), n, rate);
  }

  const scenarioInterest = estimateTotalInterest(
    newPrincipal.toFixed(2),
    newTermMonths ?? n,
    rate,
    newPayment ?? input.currentMonthlyPayment,
  );

  const saved = decimal(baselineInterest).minus(scenarioInterest);

  return {
    baselineInterestRemaining: baselineInterest,
    scenarioInterestRemaining: scenarioInterest,
    interestSaved: saved.gt(0) ? saved.toFixed(2) : "0.00",
    newTermMonths,
    newMonthlyPayment: newPayment,
    liquidityImpactNow,
    limitations,
  };
}

function estimateTotalInterest(
  principal: string,
  termMonths: number,
  annualRatePercent: string,
  monthlyPayment: string,
): string {
  let balance = decimal(principal);
  const payment = decimal(monthlyPayment);
  const r = decimal(annualRatePercent).div(100).div(12);
  let interestSum = decimal(0);
  const n = Math.max(1, Math.floor(termMonths));

  for (let i = 0; i < n && balance.gt(0); i += 1) {
    const interest = r.gt(0) ? balance.times(r) : decimal(0);
    interestSum = interestSum.plus(interest);
    const principalPart = payment.minus(interest);
    if (principalPart.lte(0)) break;
    balance = balance.minus(principalPart);
    if (balance.lt(0)) balance = decimal(0);
  }
  return interestSum.toFixed(2);
}

function estimateRemainingMonths(
  principal: string,
  annualRatePercent: string,
  monthlyPayment: string,
): number {
  let balance = decimal(principal);
  const payment = decimal(monthlyPayment);
  const r = decimal(annualRatePercent).div(100).div(12);
  if (payment.lte(0)) return 0;

  for (let m = 1; m <= 600; m += 1) {
    const interest = r.gt(0) ? balance.times(r) : decimal(0);
    const principalPart = payment.minus(interest);
    if (principalPart.lte(0)) return m;
    balance = balance.minus(principalPart);
    if (balance.lte(0)) return m;
  }
  return 600;
}

export type CashflowDeltaInput = {
  baseMonthlyIncome: string;
  baseMonthlyExpense: string;
  incomeDelta: string;
  expenseDelta: string;
  months: number;
  startingBalance: string;
};

export function simulateCashflowDelta(input: CashflowDeltaInput) {
  const months = Math.max(1, Math.min(120, input.months));
  const income = decimal(input.baseMonthlyIncome).plus(input.incomeDelta);
  const expense = decimal(input.baseMonthlyExpense).plus(input.expenseDelta);
  const net = income.minus(expense);
  let balance = decimal(input.startingBalance);
  const series: { monthIndex: number; balance: string; net: string }[] = [];
  let minBalance = balance;
  let minMonth = 1;

  for (let m = 1; m <= months; m += 1) {
    balance = balance.plus(net);
    if (balance.lt(minBalance)) {
      minBalance = balance;
      minMonth = m;
    }
    series.push({ monthIndex: m, balance: balance.toFixed(2), net: net.toFixed(2) });
  }

  return {
    monthlyNet: net.toFixed(2),
    finalBalance: balance.toFixed(2),
    minBalance: minBalance.toFixed(2),
    minBalanceMonth: minMonth,
    series,
  };
}

export type OneOffExpenseInput = {
  startingBalance: string;
  expenseAmount: string;
  /** Mês civil relativo (1 = imediato). */
  atMonthIndex: number;
  horizonMonths: number;
};

export function simulateOneOffExpense(input: OneOffExpenseInput) {
  const horizon = Math.max(1, Math.min(120, input.horizonMonths));
  const at = Math.max(1, Math.min(horizon, Math.floor(input.atMonthIndex)));
  const expense = decimal(input.expenseAmount);
  if (expense.lt(0)) throw new Error("INVALID_EXPENSE");

  let balance = decimal(input.startingBalance);
  let before = balance.toFixed(2);
  let after = balance.toFixed(2);
  let min = balance;

  for (let m = 1; m <= horizon; m += 1) {
    if (m === at) {
      before = balance.toFixed(2);
      balance = balance.minus(expense);
      after = balance.toFixed(2);
    }
    if (balance.lt(min)) min = balance;
  }

  return {
    balanceBefore: before,
    balanceAfter: after,
    minBalance: min.toFixed(2),
  };
}

export type ScenarioComparisonRow = {
  label: string;
  finalBalance: string;
  minBalance: string;
  monthlyNet?: string;
};

export type ExpenseReductionInput = {
  currentMonthlyExpense: string;
  reductionPercent: number;
};

export function simulateExpenseReduction(input: ExpenseReductionInput) {
  if (input.reductionPercent < 0 || input.reductionPercent > 100) {
    throw new Error("INVALID_REDUCTION_PERCENT");
  }
  const current = decimal(input.currentMonthlyExpense);
  const factor = decimal(100 - input.reductionPercent).div(100);
  const newMonthly = current.times(factor);
  const saved = current.minus(newMonthly);
  return {
    newMonthlyExpense: newMonthly.toFixed(2),
    monthlySavings: saved.toFixed(2),
    annualSavingsEquivalent: saved.times(12).toFixed(2),
  };
}

export function parseDecimalInput(value: string, field: string): string {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") throw new Error(`INVALID_${field}`);
  const d = decimal(trimmed);
  if (!d.isFinite()) throw new Error(`INVALID_${field}`);
  return d.toFixed(2);
}

export function compareScenarioRows(rows: readonly ScenarioComparisonRow[]) {
  if (rows.length === 0) return { baseline: null, deltas: [] as { label: string; finalDelta: string; minDelta: string }[] };
  const base = rows[0]!;
  const deltas = rows.slice(1).map((row) => ({
    label: row.label,
    finalDelta: decimal(row.finalBalance).minus(base.finalBalance).toFixed(2),
    minDelta: decimal(row.minBalance).minus(base.minBalance).toFixed(2),
  }));
  return { baseline: base, deltas };
}
