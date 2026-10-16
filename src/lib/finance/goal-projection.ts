import { decimal } from "@/lib/finance/money";

export function monthlyContributionRequired(
  targetAmount: string,
  currentAmount: string,
  monthsRemaining: number,
): string | null {
  if (monthsRemaining <= 0) return null;
  const gap = decimal(targetAmount).minus(currentAmount);
  if (gap.lte(0)) return "0.00";
  return gap.div(monthsRemaining).toFixed(2);
}

export type GoalScenario = {
  id: "CONSERVADOR" | "BASE" | "OTIMISTA";
  monthlyContribution: string;
  estimatedMonths: number | null;
  note: string;
};

export function buildGoalScenarios(input: {
  targetAmount: string;
  currentAmount: string;
  monthsRemaining: number;
  baseMonthlyContribution: string;
  conservativeFactor: string;
  optimisticFactor: string;
}): GoalScenario[] {
  const required = monthlyContributionRequired(
    input.targetAmount,
    input.currentAmount,
    input.monthsRemaining,
  );
  const base = input.baseMonthlyContribution || required || "0";
  const conservative = decimal(base).times(input.conservativeFactor).toFixed(2);
  const optimistic = decimal(base).times(input.optimisticFactor).toFixed(2);

  function monthsFor(contribution: string): number | null {
    const gap = decimal(input.targetAmount).minus(input.currentAmount);
    const monthly = decimal(contribution);
    if (monthly.lte(0) || gap.lte(0)) return 0;
    return Math.ceil(gap.div(monthly).toNumber());
  }

  return [
    {
      id: "CONSERVADOR",
      monthlyContribution: conservative,
      estimatedMonths: monthsFor(conservative),
      note: "Contribuição reduzida (fator configurável). Não é garantia de prazo.",
    },
    {
      id: "BASE",
      monthlyContribution: base,
      estimatedMonths: monthsFor(base),
      note: "Cenário base com contribuição indicada ou necessária.",
    },
    {
      id: "OTIMISTA",
      monthlyContribution: optimistic,
      estimatedMonths: monthsFor(optimistic),
      note: "Contribuição mais elevada (fator configurável). Projeção, não promessa.",
    },
  ];
}
