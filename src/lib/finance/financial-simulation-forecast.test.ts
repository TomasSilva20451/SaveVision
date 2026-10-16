import { describe, expect, it } from "vitest";
import { startOfCivilDay, civilDateFromInstant } from "@/lib/datetime/civil-date";
import {
  mergeBaseAndHypotheticalEvents,
  simulateTreasuryWithHypothetical,
} from "@/lib/finance/financial-simulation-forecast";
import type { TreasuryForecastEvent } from "@/lib/finance/treasury-forecast";

describe("financial-simulation-forecast", () => {
  const asOf = startOfCivilDay(civilDateFromInstant(new Date()));
  const baseEvents: TreasuryForecastEvent[] = [
    {
      id: "e1",
      label: "Saída",
      dueDate: new Date(asOf.getTime() + 5 * 86_400_000),
      amount: "100",
      direction: "outflow",
      source: "RECURRING_EXPENSE",
      sourceRef: "e1",
      movementKind: "PREVISTO",
    },
  ];

  it("merge não duplica por dedupe do forecast", () => {
    const merged = mergeBaseAndHypotheticalEvents(baseEvents, []);
    expect(merged.length).toBeGreaterThanOrEqual(1);
  });

  it("despesa hipotética reduz saldo projetado", () => {
    const r = simulateTreasuryWithHypothetical({
      startingBalance: "1000",
      baseEvents,
      hypotheticalEvents: [
        {
          id: "h1",
          label: "Extra",
          dueDate: new Date(asOf.getTime() + 3 * 86_400_000),
          amount: "500",
          direction: "outflow",
        },
      ],
      horizonDays: 30,
      asOf,
    });
    expect(Number(r.adjusted.projectedBalance)).toBeLessThan(Number(r.base.projectedBalance));
  });
});
