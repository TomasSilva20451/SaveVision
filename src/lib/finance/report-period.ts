import {
  civilDateFromInstant,
  formatCivilDateIso,
  startOfCivilDay,
  startOfNextCivilMonth,
  type CivilDate,
} from "@/lib/datetime/civil-date";

export type ReportPeriod = {
  from: CivilDate;
  to: CivilDate;
  fromInstant: Date;
  toExclusiveInstant: Date;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCivilDateParam(value: string | null): CivilDate | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function defaultReportPeriod(now = new Date()): ReportPeriod {
  const civil = civilDateFromInstant(now);
  const from: CivilDate = { year: civil.year, month: civil.month, day: 1 };
  const to: CivilDate = civil;
  return buildReportPeriod(from, to);
}

export function buildReportPeriod(from: CivilDate, to: CivilDate): ReportPeriod {
  const fromInstant = startOfCivilDay(from);
  const toEnd = startOfCivilDay(to);
  const toExclusiveInstant = new Date(toEnd.getTime() + 24 * 60 * 60 * 1000);
  return { from, to, fromInstant, toExclusiveInstant };
}

export function isInstantInReportPeriod(
  instant: Date,
  period: ReportPeriod,
): boolean {
  return instant >= period.fromInstant && instant < period.toExclusiveInstant;
}

export function formatReportPeriodLabel(period: ReportPeriod): string {
  return `${formatCivilDateIso(period.from)} a ${formatCivilDateIso(period.to)}`;
}

export function monthReportPeriod(year: number, month: number): ReportPeriod {
  const from: CivilDate = { year, month, day: 1 };
  const lastDay = startOfNextCivilMonth(year, month);
  const civilEnd = civilDateFromInstant(new Date(lastDay.getTime() - 1));
  return buildReportPeriod(from, civilEnd);
}
