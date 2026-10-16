import {
  civilDateFromInstant,
  formatCivilDateIso,
  startOfCivilDay,
  type CivilDate,
} from "@/lib/datetime/civil-date";

export type RecurrenceFrequency =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "YEARLY";

export type GenerateScheduleInput = {
  frequency: RecurrenceFrequency;
  start: CivilDate;
  end?: CivilDate;
  /** Dia do mês desejado (mensal+). Meses curtos usam o último dia válido. */
  dueDayOfMonth?: number;
  maxOccurrences: number;
  /** Só gerar datas >= after (inclusive) */
  after?: CivilDate;
};

function lastDayOfMonth(year: number, month: number): number {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const firstNext = startOfCivilDay({ year: nextYear, month: nextMonth, day: 1 });
  const prev = civilDateFromInstant(new Date(firstNext.getTime() - 86_400_000));
  return prev.day;
}

export function clampDayToMonth(
  year: number,
  month: number,
  desiredDay: number,
): number {
  const last = lastDayOfMonth(year, month);
  return Math.min(Math.max(desiredDay, 1), last);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Anual em 29/fev → 28/fev em anos não bissextos. */
export function annualDueDay(
  anchor: CivilDate,
  targetYear: number,
): CivilDate {
  if (anchor.month === 2 && anchor.day === 29 && !isLeapYear(targetYear)) {
    return { year: targetYear, month: 2, day: 28 };
  }
  const day = clampDayToMonth(targetYear, anchor.month, anchor.day);
  return { year: targetYear, month: anchor.month, day };
}

export function addCivilDays(date: CivilDate, days: number): CivilDate {
  const base = startOfCivilDay(date);
  return civilDateFromInstant(new Date(base.getTime() + days * 86_400_000));
}

function compareCivil(a: CivilDate, b: CivilDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function isBeforeOrEqual(a: CivilDate, b: CivilDate): boolean {
  return compareCivil(a, b) <= 0;
}

function advanceMonthly(
  current: CivilDate,
  dueDayOfMonth: number,
): CivilDate {
  let month = current.month + 1;
  let year = current.year;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  const day = clampDayToMonth(year, month, dueDayOfMonth);
  return { year, month, day };
}

function advanceQuarterly(current: CivilDate, dueDayOfMonth: number): CivilDate {
  let month = current.month + 3;
  let year = current.year;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  const day = clampDayToMonth(year, month, dueDayOfMonth);
  return { year, month, day };
}

function advanceSemiannual(current: CivilDate, dueDayOfMonth: number): CivilDate {
  let month = current.month + 6;
  let year = current.year;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  const day = clampDayToMonth(year, month, dueDayOfMonth);
  return { year, month, day };
}

function initialMonthlyDate(start: CivilDate, dueDayOfMonth: number): CivilDate {
  const day = clampDayToMonth(start.year, start.month, dueDayOfMonth);
  let candidate = { year: start.year, month: start.month, day };
  if (compareCivil(candidate, start) < 0) {
    candidate = advanceMonthly(candidate, dueDayOfMonth);
  }
  return candidate;
}

export function generateRecurringDueDates(input: GenerateScheduleInput): CivilDate[] {
  const { frequency, start, end, maxOccurrences, after } = input;
  const dueDay = input.dueDayOfMonth ?? start.day;
  const results: CivilDate[] = [];
  const lower = after ?? start;

  if (frequency === "WEEKLY" || frequency === "BIWEEKLY") {
    const step = frequency === "WEEKLY" ? 7 : 14;
    let cursor = start;
    while (results.length < maxOccurrences) {
      if (end && compareCivil(cursor, end) > 0) break;
      if (isBeforeOrEqual(lower, cursor)) {
        results.push(cursor);
      }
      cursor = addCivilDays(cursor, step);
    }
    return results;
  }

  let cursor: CivilDate;
  if (
    frequency === "MONTHLY" ||
    frequency === "QUARTERLY" ||
    frequency === "SEMIANNUAL"
  ) {
    cursor = initialMonthlyDate(start, dueDay);
  } else {
    cursor = annualDueDay(start, start.year);
    if (compareCivil(cursor, start) < 0) {
      cursor = annualDueDay(start, start.year + 1);
    }
  }

  while (results.length < maxOccurrences) {
    if (end && compareCivil(cursor, end) > 0) break;
    if (isBeforeOrEqual(lower, cursor)) {
      results.push({ ...cursor });
    }
    switch (frequency) {
      case "MONTHLY":
        cursor = advanceMonthly(cursor, dueDay);
        break;
      case "QUARTERLY":
        cursor = advanceQuarterly(cursor, dueDay);
        break;
      case "SEMIANNUAL":
        cursor = advanceSemiannual(cursor, dueDay);
        break;
      case "YEARLY":
        cursor = annualDueDay(start, cursor.year + 1);
        break;
      default:
        break;
    }
  }

  return results;
}

export function civilDateToDueInstant(date: CivilDate): Date {
  return startOfCivilDay(date);
}

export function dueInstantToCivilKey(instant: Date): string {
  return formatCivilDateIso(civilDateFromInstant(instant));
}
