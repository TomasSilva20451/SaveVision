import {
  civilDateFromInstant,
  formatCivilDateIso,
  startOfCivilDay,
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
