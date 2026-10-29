import type { CivilDate } from "@/lib/datetime/civil-date";
import { budgetUtilizationPercent, type BudgetLineSnapshot } from "@/lib/finance/budget";
import { decimal } from "@/lib/finance/money";
import {
  amountRemaining,
  civilWeekday,
  computePlanProgress,
  weeksRemaining,
} from "@/lib/finance/savings-plan-engine";

export type WeeklyReviewCheckIn = {
  status: "DUE" | "COMPLETED" | "MISSED" | "SKIPPED";
  expectedAmount: string;
  periodStartIso: string;
  periodEndIso: string;
};

export type WeeklyReviewWithdrawal = {
  amount: string;
  occurredAtIso: string;
  description: string | null;
};

export type WeeklyReviewInput = {
  asOf: Date;
  today: CivilDate;
  reviewWeekday: number;
  targetAmount: string;
  targetDateIso: string | null;
  contributionAmounts: readonly string[];
  plannedWeeklyContribution: string;
  checkIns: readonly WeeklyReviewCheckIn[];
  budgetLines: readonly BudgetLineSnapshot[];
  alertThresholdPercent: number;
  withdrawalsThisWeek: readonly WeeklyReviewWithdrawal[];
};

export type WeeklyReviewSnapshot = {
  isReviewDay: boolean;
  contributionRegisteredThisWeek: boolean;
  contributedTotal: string;
  categoriesAboveThreshold: { name: string; utilizationPercent: number }[];
  protectedAccountWithdrawals: WeeklyReviewWithdrawal[];
  amountRemaining: string;
  weeksRemaining: number;
  weeklyContributionNeeded: string;
  progressPercent: number | null;
  targetReached: boolean;
  deterministicProjectionNote: string;
};

export function isReviewCivilDay(today: CivilDate, reviewWeekday: number): boolean {
  return civilWeekday(today) === reviewWeekday;
}

export function buildWeeklyReviewSnapshot(input: WeeklyReviewInput): WeeklyReviewSnapshot {
  const progress = computePlanProgress({
    targetAmount: input.targetAmount,
    contributionAmounts: input.contributionAmounts,
    targetDateIso: input.targetDateIso,
    asOf: input.asOf,
  });

  const currentWeekCheckIn = input.checkIns.find((c) => {
    return c.periodStartIso <= formatCompare(input.today) && c.periodEndIso >= formatCompare(input.today);
  });

  function formatCompare(d: CivilDate): string {
    return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  }

  const contributionRegisteredThisWeek = currentWeekCheckIn?.status === "COMPLETED";

  const categoriesAboveThreshold = input.budgetLines
    .map((line) => ({
      name: line.categoryName,
      utilizationPercent: budgetUtilizationPercent(line.limitAmount, line.spentAmount),
    }))
    .filter(
      (row): row is { name: string; utilizationPercent: number } =>
        row.utilizationPercent != null &&
        row.utilizationPercent >= input.alertThresholdPercent,
    );

  const remaining = amountRemaining(input.targetAmount, progress.contributed);
  const weeksLeft = input.targetDateIso
    ? weeksRemaining(input.today, parseTarget(input.targetDateIso), input.reviewWeekday)
    : 0;

  let weeklyNeeded = input.plannedWeeklyContribution;
  if (weeksLeft > 0 && decimal(remaining).gt(0)) {
    weeklyNeeded = decimal(remaining).div(weeksLeft).toDecimalPlaces(2).toFixed(2);
  }

  let projectionNote =
    "Projeção determinística: mantendo o ritmo semanal planeado, o objetivo mantém-se alinhado com a data-alvo.";
  if (progress.targetReached) {
    projectionNote = "Objectivo já atingido com contribuições registadas.";
  } else if (weeksLeft === 0 && !progress.targetReached) {
    projectionNote = "Data-alvo ultrapassada — revê o montante semanal necessário para fechar a diferença.";
  } else if (decimal(weeklyNeeded).gt(input.plannedWeeklyContribution)) {
    projectionNote = `Para fechar ${remaining} € em ${weeksLeft} semana(s), seriam necessários ~${weeklyNeeded} €/semana (estimativa, sem criar movimentos).`;
  }

  return {
    isReviewDay: isReviewCivilDay(input.today, input.reviewWeekday),
    contributionRegisteredThisWeek,
    contributedTotal: progress.contributed,
    categoriesAboveThreshold,
    protectedAccountWithdrawals: [...input.withdrawalsThisWeek],
    amountRemaining: remaining,
    weeksRemaining: weeksLeft,
    weeklyContributionNeeded: weeklyNeeded,
    progressPercent: progress.progressPercent,
    targetReached: progress.targetReached,
    deterministicProjectionNote: projectionNote,
  };
}

function parseTarget(iso: string): CivilDate {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}
