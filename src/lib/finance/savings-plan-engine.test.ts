import { describe, expect, it } from "vitest";
import { parseCivilDateIso as parseIso } from "@/lib/datetime/civil-date";
import {
  amountRemaining,
  buildWeeklyPeriods,
  computePlanProgress,
  nextOrSameWeekday,
  proportionalMonthLimit,
  weeksRemaining,
} from "@/lib/finance/savings-plan-engine";

describe("savings-plan-engine", () => {
  it("ancora semanas no domingo até à data-alvo", () => {
    const start = parseIso("2026-10-28");
    const target = parseIso("2026-11-15");
    const periods = buildWeeklyPeriods(start, target, 7);
    expect(periods.length).toBeGreaterThan(0);
    expect(periods[0]!.periodStart.day).toBeLessThanOrEqual(2);
  });

  it("calcula semanas restantes", () => {
    const asOf = parseIso("2026-10-28");
    const target = parseIso("2027-01-20");
    expect(weeksRemaining(asOf, target, 7)).toBeGreaterThan(0);
  });

  it("montante em falta e progresso", () => {
    expect(amountRemaining("300.00", "50.00")).toBe("250.00");
    const snap = computePlanProgress({
      targetAmount: "300.00",
      contributionAmounts: ["150.00", "200.00"],
      targetDateIso: "2027-01-20",
      asOf: new Date("2026-11-01T12:00:00Z"),
    });
    expect(snap.targetOverfilled).toBe(true);
    expect(snap.targetReached).toBe(true);
  });

  it("nextOrSameWeekday encontra domingo", () => {
    const wed = parseIso("2026-10-28");
    const sun = nextOrSameWeekday(wed, 7);
    expect(sun.day).toBe(1);
    expect(sun.month).toBe(11);
  });

  it("limite proporcional no mês parcial", () => {
    const asOf = new Date("2026-10-28T10:00:00.000Z");
    const limit = proportionalMonthLimit("180.00", 2026, 10, asOf);
    expect(Number(limit)).toBeLessThan(180);
    expect(Number(limit)).toBeGreaterThan(0);
  });
});
