import { decimal } from "@/lib/finance/money";

export type ScenarioInput = {
  currentBalance: string;
  monthlyIncomeDelta: string;
  monthlyExpenseDelta: string;
  months: number;
};

export type ScenarioMonth = {
  monthIndex: number;
  projectedBalance: string;
};

export function simulateBalanceScenario(input: ScenarioInput): ScenarioMonth[] {
  const months = Math.max(1, Math.min(60, input.months));
  let balance = decimal(input.currentBalance);
  const incomeDelta = decimal(input.monthlyIncomeDelta);
  const expenseDelta = decimal(input.monthlyExpenseDelta);
  const monthlyNet = incomeDelta.minus(expenseDelta);

  const series: ScenarioMonth[] = [];
  for (let i = 1; i <= months; i += 1) {
    balance = balance.plus(monthlyNet);
    series.push({
      monthIndex: i,
      projectedBalance: balance.toFixed(2),
    });
  }
  return series;
}
