import {
  civilDateFromInstant,
  formatCivilDateIso,
  startOfCivilDay,
  parseCivilDateIso,
  type CivilDate,
} from "@/lib/datetime/civil-date";
import { addMoney, decimal } from "@/lib/finance/money";

export const TREASURY_HORIZON_DAYS = [7, 30, 60, 90, 180, 365] as const;

export type TreasuryHorizonDays = (typeof TREASURY_HORIZON_DAYS)[number];

export type TreasuryEventSource =
  | "INCOME_EXPECTED"
  | "RECURRING_EXPENSE"
  | "LIABILITY_MONTHLY_PAYMENT";

export type TreasuryForecastEvent = {
  id: string;
  label: string;
  dueDate: Date;
  amount: string;
  direction: "inflow" | "outflow";
  source: TreasuryEventSource;
  sourceRef: string;
  movementKind: "PREVISTO";
  categoryLabel?: string;
};

export type TreasuryForecastEventStep = TreasuryForecastEvent & {
  balanceAfter: string;
};

export function treasuryEventSourceLabel(source: TreasuryEventSource): string {
  switch (source) {
    case "INCOME_EXPECTED":
      return "Receita prevista";
    case "RECURRING_EXPENSE":
      return "Despesa recorrente";
    case "LIABILITY_MONTHLY_PAYMENT":
      return "Prestação de passivo (caixa)";
    default:
      return "Previsto";
  }
}

export type TreasuryProjectionPoint = {
  civilDate: string;
  projectedBalance: string;
  cumulativeInflows: string;
  cumulativeOutflows: string;
};

export type TreasuryProjectionResult = {
  startingBalance: string;
  projectedBalance: string;
  expectedInflows: string;
  expectedOutflows: string;
  netExpected: string;
  horizonDays: number;
  horizonEndCivil: string;
  events: TreasuryForecastEvent[];
  eventSteps: TreasuryForecastEventStep[];
  timeline: TreasuryProjectionPoint[];
};

export type TreasuryMonthlyFlow = {
  key: string;
  label: string;
  periodLabel: string;
  isPartial: boolean;
  expectedInflows: string;
  expectedOutflows: string;
  netExpected: string;
  projectedBalance: string;
};

export type TreasuryScenarioAssumptions = {
  incomePercentChange: string;
  recurringExpensePercentChange: string;
};

export type TreasuryOutflowGroup = {
  label: string;
  amount: string;
  percent: number;
};

function compareCivil(a: CivilDate, b: CivilDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function addCivilDays(date: CivilDate, days: number): CivilDate {
  const base = startOfCivilDay(date);
  return civilDateFromInstant(new Date(base.getTime() + days * 86_400_000));
}

export function treasuryHorizonEnd(asOf: Date, horizonDays: number): Date {
  const asOfCivil = civilDateFromInstant(asOf);
  const endCivil = addCivilDays(asOfCivil, Math.max(1, Math.min(365, horizonDays)));
  return startOfCivilDay(endCivil);
}

export function treasuryHorizonStart(asOf: Date): Date {
  return startOfCivilDay(civilDateFromInstant(asOf));
}

export function buildTreasuryProjection(input: {
  startingBalance: string;
  events: TreasuryForecastEvent[];
  horizonDays: number;
  asOf?: Date;
}): TreasuryProjectionResult {
  const horizonDays = Math.max(1, Math.min(365, input.horizonDays));
  const asOf = input.asOf ?? new Date();
  const asOfCivil = civilDateFromInstant(asOf);
  const horizonEndCivil = addCivilDays(asOfCivil, horizonDays);
  const horizonEndInstant = startOfCivilDay(horizonEndCivil);

  const inHorizon = input.events.filter((event) => {
    const eventCivil = civilDateFromInstant(event.dueDate);
    if (compareCivil(eventCivil, asOfCivil) < 0) return false;
    return event.dueDate.getTime() <= horizonEndInstant.getTime();
  });

  inHorizon.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  let inflows = decimal(0);
  let outflows = decimal(0);
  for (const event of inHorizon) {
    const abs = decimal(event.amount).abs();
    if (event.direction === "inflow") {
      inflows = inflows.plus(abs);
    } else {
      outflows = outflows.plus(abs);
    }
  }

  const starting = decimal(input.startingBalance);
  const projected = starting.plus(inflows).minus(outflows);

  const timeline: TreasuryProjectionPoint[] = [];
  const eventSteps: TreasuryForecastEventStep[] = [];
  let cursor = starting;
  let cumIn = decimal(0);
  let cumOut = decimal(0);

  timeline.push({
    civilDate: formatCivilDateIso(asOfCivil),
    projectedBalance: cursor.toFixed(2),
    cumulativeInflows: "0.00",
    cumulativeOutflows: "0.00",
  });

  for (const event of inHorizon) {
    const abs = decimal(event.amount).abs();
    if (event.direction === "inflow") {
      cursor = cursor.plus(abs);
      cumIn = cumIn.plus(abs);
    } else {
      cursor = cursor.minus(abs);
      cumOut = cumOut.plus(abs);
    }
    const balanceAfter = cursor.toFixed(2);
    eventSteps.push({ ...event, balanceAfter });
    timeline.push({
      civilDate: formatCivilDateIso(civilDateFromInstant(event.dueDate)),
      projectedBalance: balanceAfter,
      cumulativeInflows: cumIn.toFixed(2),
      cumulativeOutflows: cumOut.toFixed(2),
    });
  }

  if (timeline.at(-1)?.civilDate !== formatCivilDateIso(horizonEndCivil)) {
    timeline.push({
      civilDate: formatCivilDateIso(horizonEndCivil),
      projectedBalance: cursor.toFixed(2),
      cumulativeInflows: cumIn.toFixed(2),
      cumulativeOutflows: cumOut.toFixed(2),
    });
  }

  return {
    startingBalance: starting.toFixed(2),
    projectedBalance: projected.toFixed(2),
    expectedInflows: inflows.toFixed(2),
    expectedOutflows: outflows.toFixed(2),
    netExpected: inflows.minus(outflows).toFixed(2),
    horizonDays,
    horizonEndCivil: formatCivilDateIso(horizonEndCivil),
    events: inHorizon,
    eventSteps,
    timeline,
  };
}

export function applyTreasuryScenarioAssumptions(
  events: readonly TreasuryForecastEvent[],
  assumptions: TreasuryScenarioAssumptions,
): TreasuryForecastEvent[] {
  const incomeFactor = decimal(1).plus(decimal(assumptions.incomePercentChange).div(100));
  const recurringFactor = decimal(1).plus(
    decimal(assumptions.recurringExpensePercentChange).div(100),
  );

  return events.map((event) => {
    const factor =
      event.source === "INCOME_EXPECTED"
        ? incomeFactor
        : event.source === "RECURRING_EXPENSE"
          ? recurringFactor
          : decimal(1);
    return { ...event, amount: decimal(event.amount).abs().times(factor).toFixed(2) };
  });
}

export function buildTreasuryScenarioProjection(input: {
  startingBalance: string;
  events: readonly TreasuryForecastEvent[];
  horizonDays: number;
  asOf: Date;
  assumptions: TreasuryScenarioAssumptions;
}): TreasuryProjectionResult {
  return buildTreasuryProjection({
    startingBalance: input.startingBalance,
    events: applyTreasuryScenarioAssumptions(input.events, input.assumptions),
    horizonDays: input.horizonDays,
    asOf: input.asOf,
  });
}

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export function aggregateTreasuryProjectionByMonth(
  projection: TreasuryProjectionResult,
): TreasuryMonthlyFlow[] {
  const start = parseCivilDateIso(projection.timeline[0]?.civilDate ?? projection.horizonEndCivil);
  const end = parseCivilDateIso(projection.horizonEndCivil);
  const eventsByMonth = new Map<string, TreasuryForecastEvent[]>();
  for (const event of projection.events) {
    const civil = civilDateFromInstant(event.dueDate);
    const key = `${civil.year}-${String(civil.month).padStart(2, "0")}`;
    eventsByMonth.set(key, [...(eventsByMonth.get(key) ?? []), event]);
  }

  const rows: TreasuryMonthlyFlow[] = [];
  let balance = decimal(projection.startingBalance);
  let year = start.year;
  let month = start.month;

  while (year < end.year || (year === end.year && month <= end.month)) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const monthEvents = eventsByMonth.get(key) ?? [];
    let inflows = decimal(0);
    let outflows = decimal(0);
    for (const event of monthEvents) {
      if (event.direction === "inflow") inflows = inflows.plus(decimal(event.amount).abs());
      else outflows = outflows.plus(decimal(event.amount).abs());
    }
    const net = inflows.minus(outflows);
    balance = balance.plus(net);
    const firstDay = year === start.year && month === start.month ? start.day : 1;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const lastDay = year === end.year && month === end.month ? end.day : lastDayOfMonth;
    const isPartial = firstDay !== 1 || lastDay !== lastDayOfMonth;
    const monthLabel = `${MONTH_LABELS[month - 1]} ${year}`;
    rows.push({
      key,
      label: monthLabel,
      periodLabel: isPartial ? `${firstDay}–${lastDay} ${monthLabel}` : monthLabel,
      isPartial,
      expectedInflows: inflows.toFixed(2),
      expectedOutflows: outflows.toFixed(2),
      netExpected: net.toFixed(2),
      projectedBalance: balance.toFixed(2),
    });

    if (month === 12) {
      year += 1;
      month = 1;
    } else {
      month += 1;
    }
  }
  return rows;
}

export function groupTreasuryOutflows(
  events: readonly TreasuryForecastEvent[],
): TreasuryOutflowGroup[] {
  const totals = new Map<string, ReturnType<typeof decimal>>();
  for (const event of events) {
    if (event.direction !== "outflow") continue;
    const label =
      event.categoryLabel ??
      (event.source === "LIABILITY_MONTHLY_PAYMENT"
        ? "Prestações e obrigações"
        : "Outras saídas");
    totals.set(label, (totals.get(label) ?? decimal(0)).plus(decimal(event.amount).abs()));
  }
  const total = [...totals.values()].reduce((sum, value) => sum.plus(value), decimal(0));
  return [...totals.entries()]
    .map(([label, amount]) => ({
      label,
      amount: amount.toFixed(2),
      percent: total.isZero() ? 0 : amount.div(total).times(100).toDecimalPlaces(1).toNumber(),
    }))
    .sort((a, b) => decimal(b.amount).cmp(decimal(a.amount)));
}

/** Validação do exemplo de negócio 1500 + 500 - 45 - 70 = 1885. */
export function exampleTreasuryScenario(): TreasuryProjectionResult {
  const today = startOfCivilDay(civilDateFromInstant(new Date()));
  return buildTreasuryProjection({
    startingBalance: "1500",
    horizonDays: 30,
    asOf: today,
    events: [
      {
        id: "inc-1",
        label: "Receita prevista",
        dueDate: new Date(today.getTime() + 5 * 86_400_000),
        amount: "500",
        direction: "inflow",
        source: "INCOME_EXPECTED",
        sourceRef: "inc-1",
        movementKind: "PREVISTO",
      },
      {
        id: "exp-1",
        label: "Internet",
        dueDate: new Date(today.getTime() + 10 * 86_400_000),
        amount: "45",
        direction: "outflow",
        source: "RECURRING_EXPENSE",
        sourceRef: "exp-1",
        movementKind: "PREVISTO",
      },
      {
        id: "exp-2",
        label: "Eletricidade",
        dueDate: new Date(today.getTime() + 12 * 86_400_000),
        amount: "70",
        direction: "outflow",
        source: "RECURRING_EXPENSE",
        sourceRef: "exp-2",
        movementKind: "PREVISTO",
      },
    ],
  });
}

export function sumStartingBalance(accountBalances: readonly string[]): string {
  return addMoney(accountBalances).toFixed(2);
}
