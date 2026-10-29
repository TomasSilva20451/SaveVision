import {
  civilDateFromInstant,
  civilDateIsoToInstant,
  formatCivilDateIso,
  parseCivilDateIso,
  startOfCivilMonth,
  startOfNextCivilMonth,
  type CivilDate,
} from "@/lib/datetime/civil-date";
import { budgetUtilizationPercent } from "@/lib/finance/budget";
import { goalProgressPercent, sumContributions } from "@/lib/finance/goal-progress";
import { decimal } from "@/lib/finance/money";

function compareCivil(a: CivilDate, b: CivilDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/** ISO weekday: Monday=1 … Sunday=7 */
export function civilWeekday(iso: CivilDate): number {
  const instant = civilDateIsoToInstant(formatCivilDateIso(iso));
  const day = instant.getUTCDay();
  return day === 0 ? 7 : day;
}

export function addCivilDays(iso: CivilDate, days: number): CivilDate {
  const instant = civilDateIsoToInstant(formatCivilDateIso(iso));
  instant.setUTCDate(instant.getUTCDate() + days);
  return civilDateFromInstant(instant);
}

export type WeeklyPeriod = {
  periodStart: CivilDate;
  periodEnd: CivilDate;
};

export function nextOrSameWeekday(from: CivilDate, isoWeekday: number): CivilDate {
  let cursor = from;
  for (let i = 0; i < 7; i += 1) {
    if (civilWeekday(cursor) === isoWeekday) return cursor;
    cursor = addCivilDays(cursor, 1);
  }
  return from;
}

/** Semanas civis ancoradas no dia de contribuição até à data-alvo (inclusiva). */
export function buildWeeklyPeriods(
  start: CivilDate,
  target: CivilDate,
  anchorWeekday = 7,
): WeeklyPeriod[] {
  if (compareCivil(target, start) < 0) return [];
  const firstStart = nextOrSameWeekday(start, anchorWeekday);
  const periods: WeeklyPeriod[] = [];
  let cursor = firstStart;
  while (compareCivil(cursor, target) <= 0) {
    const end = addCivilDays(cursor, 6);
    periods.push({ periodStart: cursor, periodEnd: end });
    cursor = addCivilDays(end, 1);
    cursor = nextOrSameWeekday(cursor, anchorWeekday);
  }
  return periods;
}

export function weeksRemaining(
  asOf: CivilDate,
  target: CivilDate,
  anchorWeekday = 7,
): number {
  return buildWeeklyPeriods(asOf, target, anchorWeekday).length;
}

export function civilMonthsThroughTarget(
  fromYear: number,
  fromMonth: number,
  targetIso: string,
): { year: number; month: number }[] {
  const target = parseCivilDateIso(targetIso);
  const out: { year: number; month: number }[] = [];
  let y = fromYear;
  let m = fromMonth;
  while (y < target.year || (y === target.year && m <= target.month)) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function proportionalMonthLimit(fullLimit: string, year: number, month: number, asOf: Date): string {
  const civil = civilDateFromInstant(asOf);
  if (civil.year !== year || civil.month !== month) return fullLimit;
  const daysInMonth = Math.round(
    (startOfNextCivilMonth(year, month).getTime() - startOfCivilMonth(year, month).getTime()) /
      86_400_000,
  );
  const remainingDays = daysInMonth - civil.day + 1;
  if (remainingDays >= daysInMonth) return fullLimit;
  return decimal(fullLimit)
    .times(remainingDays)
    .div(daysInMonth)
    .toDecimalPlaces(2)
    .toFixed(2);
}

export function amountRemaining(target: string, contributed: string): string {
  const diff = decimal(target).minus(contributed);
  return diff.gt(0) ? diff.toFixed(2) : "0.00";
}

export type PlanProgressSnapshot = {
  contributed: string;
  target: string;
  progressPercent: number | null;
  amountRemaining: string;
  targetReached: boolean;
  targetOverfilled: boolean;
  targetDatePassed: boolean;
};

export function computePlanProgress(input: {
  targetAmount: string;
  contributionAmounts: readonly string[];
  targetDateIso: string | null;
  asOf: Date;
}): PlanProgressSnapshot {
  const contributed = sumContributions(input.contributionAmounts).toFixed(2);
  const target = decimal(input.targetAmount).toFixed(2);
  const progressPercent = goalProgressPercent(contributed, target);
  const remaining = amountRemaining(target, contributed);
  const targetReached = decimal(contributed).gte(target);
  const targetOverfilled = decimal(contributed).gt(target);
  let targetDatePassed = false;
  if (input.targetDateIso) {
    const targetCivil = parseCivilDateIso(input.targetDateIso);
    const today = civilDateFromInstant(input.asOf);
    targetDatePassed = compareCivil(today, targetCivil) > 0;
  }
  return {
    contributed,
    target,
    progressPercent,
    amountRemaining: remaining,
    targetReached,
    targetOverfilled,
    targetDatePassed,
  };
}

export function planBudgetAlertAtThreshold(
  limit: string,
  spent: string,
  thresholdPercent: number,
): boolean {
  const utilization = budgetUtilizationPercent(limit, spent);
  return utilization != null && utilization >= thresholdPercent;
}

export function normalizeCategoryLabel(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function slugifyPlanName(name: string): string {
  return normalizeCategoryLabel(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
