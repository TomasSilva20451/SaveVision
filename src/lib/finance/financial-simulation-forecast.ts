import { civilDateFromInstant, startOfCivilDay } from "@/lib/datetime/civil-date";
import { minProjectedBalanceInTimeline } from "@/lib/finance/financial-alerts";
import {
  buildTreasuryProjection,
  type TreasuryForecastEvent,
  type TreasuryProjectionResult,
} from "@/lib/finance/treasury-forecast";
import { deduplicateTreasuryEvents } from "@/lib/finance/treasury-liability-events";

export type HypotheticalTreasuryEvent = {
  id: string;
  label: string;
  dueDate: Date;
  amount: string;
  direction: "inflow" | "outflow";
};

export function toHypotheticalForecastEvents(
  rows: readonly HypotheticalTreasuryEvent[],
): TreasuryForecastEvent[] {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    dueDate: row.dueDate,
    amount: row.amount,
    direction: row.direction,
    source: "RECURRING_EXPENSE" as const,
    sourceRef: row.id,
    movementKind: "PREVISTO" as const,
  }));
}

export function mergeBaseAndHypotheticalEvents(
  baseEvents: readonly TreasuryForecastEvent[],
  hypothetical: readonly HypotheticalTreasuryEvent[],
): TreasuryForecastEvent[] {
  const merged = [...baseEvents, ...toHypotheticalForecastEvents(hypothetical)];
  return deduplicateTreasuryEvents(merged);
}

export type TreasurySimulationInput = {
  startingBalance: string;
  baseEvents: readonly TreasuryForecastEvent[];
  hypotheticalEvents: readonly HypotheticalTreasuryEvent[];
  horizonDays: number;
  asOf: Date;
};

export type TreasurySimulationResult = {
  base: TreasuryProjectionResult;
  adjusted: TreasuryProjectionResult;
  minProjectedBase: string | null;
  minProjectedAdjusted: string | null;
  minDateBase: string | null;
  minDateAdjusted: string | null;
};

export function simulateTreasuryWithHypothetical(
  input: TreasurySimulationInput,
): TreasurySimulationResult {
  const base = buildTreasuryProjection({
    startingBalance: input.startingBalance,
    events: [...input.baseEvents],
    horizonDays: input.horizonDays,
    asOf: input.asOf,
  });

  const adjustedEvents = mergeBaseAndHypotheticalEvents(
    input.baseEvents,
    input.hypotheticalEvents,
  );
  const adjusted = buildTreasuryProjection({
    startingBalance: input.startingBalance,
    events: adjustedEvents,
    horizonDays: input.horizonDays,
    asOf: input.asOf,
  });

  const minBase = minProjectedBalanceInTimeline(base.timeline);
  const minAdj = minProjectedBalanceInTimeline(adjusted.timeline);

  return {
    base,
    adjusted,
    minProjectedBase: minBase?.minBalance ?? null,
    minProjectedAdjusted: minAdj?.minBalance ?? null,
    minDateBase: minBase?.civilDate ?? null,
    minDateAdjusted: minAdj?.civilDate ?? null,
  };
}

/** Despesa única simulada como evento de tesouraria na data civil indicada. */
export function oneOffOutflowEvent(
  id: string,
  label: string,
  amount: string,
  dueDate: Date,
): HypotheticalTreasuryEvent {
  return {
    id,
    label,
    dueDate: startOfCivilDay(civilDateFromInstant(dueDate)),
    amount,
    direction: "outflow",
  };
}
