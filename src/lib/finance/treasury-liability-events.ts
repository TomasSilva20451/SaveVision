import {
  civilDateFromInstant,
  formatCivilDateIso,
  startOfCivilDay,
  type CivilDate,
} from "@/lib/datetime/civil-date";
import { decimal } from "@/lib/finance/money";
import type { TreasuryForecastEvent } from "@/lib/finance/treasury-forecast";

function compareCivil(a: CivilDate, b: CivilDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function advanceMonthly(current: CivilDate, dueDay: number): CivilDate {
  let month = current.month + 1;
  let year = current.year;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(dueDay, 1), lastDay);
  return { year, month, day };
}

/**
 * Prestações futuras com base em `monthlyPayment` registado.
 * Saída de caixa = montante mensal; não inventa juros/capital futuros.
 */
export function generateLiabilityMonthlyOutflows(input: {
  liabilityId: string;
  title: string;
  monthlyPayment: string;
  outstandingBalance: string;
  scheduleAnchor: CivilDate;
  paymentDueDayOfMonth?: number | null;
  horizonStart: Date;
  horizonEnd: Date;
}): TreasuryForecastEvent[] {
  if (input.paymentDueDayOfMonth == null) {
    return [];
  }
  const payment = decimal(input.monthlyPayment);
  if (payment.lte(0)) return [];

  const outstanding = decimal(input.outstandingBalance);
  if (outstanding.lte(0)) return [];

  const maxPayments = Math.min(
    500,
    Math.max(1, outstanding.div(payment).ceil().toNumber()),
  );

  const horizonStartCivil = civilDateFromInstant(input.horizonStart);
  const horizonEndCivil = civilDateFromInstant(input.horizonEnd);
  const dueDay = input.paymentDueDayOfMonth;
  let cursor = {
    year: input.scheduleAnchor.year,
    month: input.scheduleAnchor.month,
    day: Math.min(
      dueDay,
      new Date(input.scheduleAnchor.year, input.scheduleAnchor.month, 0).getDate(),
    ),
  };

  const events: TreasuryForecastEvent[] = [];
  let remaining = outstanding;

  for (let i = 0; i < maxPayments; i += 1) {
    if (compareCivil(cursor, horizonStartCivil) < 0) {
      cursor = advanceMonthly(cursor, dueDay);
      continue;
    }
    if (compareCivil(cursor, horizonEndCivil) > 0) break;

    const cashOut = payment.lte(remaining) ? payment : remaining;
    if (cashOut.lte(0)) break;

    events.push({
      id: `liability-${input.liabilityId}-${formatCivilDateIso(cursor)}`,
      label: input.title,
      dueDate: startOfCivilDay(cursor),
      amount: cashOut.toFixed(2),
      direction: "outflow",
      source: "LIABILITY_MONTHLY_PAYMENT",
      sourceRef: input.liabilityId,
      movementKind: "PREVISTO",
    });

    remaining = remaining.minus(cashOut);
    cursor = advanceMonthly(cursor, dueDay);
  }

  return events;
}

/** Evita duplicar o mesmo evento lógico (origem + id). */
export function deduplicateTreasuryEvents(
  events: readonly TreasuryForecastEvent[],
): TreasuryForecastEvent[] {
  const seen = new Set<string>();
  const out: TreasuryForecastEvent[] = [];
  for (const event of events) {
    const key = `${event.source}:${event.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }
  return out.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}
