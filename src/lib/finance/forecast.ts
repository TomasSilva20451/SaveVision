import { decimal } from "@/lib/finance/money";

export type ForecastInput = {
  startingBalance: string;
  expectedMonthlyIncome: string;
  expectedMonthlyExpenses: string;
  horizonMonths: number;
};

export type ForecastPoint = {
  monthIndex: number;
  projectedBalance: string;
  projectedIncome: string;
  projectedExpenses: string;
};

export function deterministicBalanceForecast(
  input: ForecastInput,
): ForecastPoint[] {
  const months = Math.max(1, Math.min(24, input.horizonMonths));
  let balance = decimal(input.startingBalance);
  const income = decimal(input.expectedMonthlyIncome);
  const expenses = decimal(input.expectedMonthlyExpenses);

  const points: ForecastPoint[] = [];
  for (let i = 1; i <= months; i += 1) {
    balance = balance.plus(income).minus(expenses);
    points.push({
      monthIndex: i,
      projectedBalance: balance.toFixed(2),
      projectedIncome: income.toFixed(2),
      projectedExpenses: expenses.toFixed(2),
    });
  }
  return points;
}

export type RuleAlert = {
  code: string;
  severity: "info" | "warning";
  message: string;
};

export function buildRuleBasedAlerts(input: {
  cashFlowMonth: string;
  savingsBalance: string;
  emergencyTarget: string;
}): RuleAlert[] {
  const alerts: RuleAlert[] = [];
  const cashFlow = decimal(input.cashFlowMonth);
  if (cashFlow.lt(0)) {
    alerts.push({
      code: "negative_cashflow",
      severity: "warning",
      message: "Cash flow negativo no mês corrente.",
    });
  }
  const savings = decimal(input.savingsBalance);
  const emergency = decimal(input.emergencyTarget);
  if (emergency.gt(0) && savings.lt(emergency)) {
    alerts.push({
      code: "emergency_gap",
      severity: "info",
      message: "Poupança abaixo do objetivo de fundo de emergência.",
    });
  }
  return alerts;
}
