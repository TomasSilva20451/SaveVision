import { decimal } from "@/lib/finance/money";

export type HealthScoreInput = {
  savingsBalance: string;
  monthlyExpenses: string;
  emergencyTargetMonths: number;
  monthlyIncome: string;
  monthlyCashFlow: string;
  goalProgressAverage: number | null;
};

export type HealthScoreFactor = {
  id: string;
  label: string;
  impact: number;
  detail: string;
};

export type HealthScoreResult = {
  score: number;
  factors: HealthScoreFactor[];
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateFinancialHealthScore(
  input: HealthScoreInput,
): HealthScoreResult {
  const factors: HealthScoreFactor[] = [];
  let score = 50;

  const expenses = decimal(input.monthlyExpenses);
  const savings = decimal(input.savingsBalance);
  const income = decimal(input.monthlyIncome);
  const cashFlow = decimal(input.monthlyCashFlow);

  if (expenses.gt(0)) {
    const monthsCovered = savings.div(expenses);
    const target = input.emergencyTargetMonths;
    const ratio = monthsCovered.div(target);
    const emergencyPoints = ratio.times(25).toNumber();
    score += Math.min(25, emergencyPoints) - 12.5;
    factors.push({
      id: "emergency",
      label: "Fundo de emergência",
      impact: Math.round(emergencyPoints - 12.5),
      detail: `${monthsCovered.toFixed(1)} meses de despesas (objetivo ${target} meses).`,
    });
  } else {
    factors.push({
      id: "emergency",
      label: "Fundo de emergência",
      impact: 0,
      detail: "Sem despesas mensais de referência definidas.",
    });
  }

  if (income.gt(0)) {
    const savingsRate = cashFlow.div(income);
    const ratePoints = savingsRate.times(100).times(0.25).toNumber();
    const bounded = Math.max(-15, Math.min(25, ratePoints));
    score += bounded;
    factors.push({
      id: "cashflow",
      label: "Taxa de poupança mensal",
      impact: Math.round(bounded),
      detail: `Cash flow ${cashFlow.toFixed(2)} € face a receitas ${income.toFixed(2)} €.`,
    });
  }

  if (input.goalProgressAverage != null) {
    const goalPoints = (input.goalProgressAverage / 100) * 15;
    score += goalPoints - 7.5;
    factors.push({
      id: "goals",
      label: "Objetivos financeiros",
      impact: Math.round(goalPoints - 7.5),
      detail: `Progresso médio ${input.goalProgressAverage.toFixed(0)} %.`,
    });
  }

  return { score: clampScore(score), factors };
}
