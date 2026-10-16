import { describe, expect, it } from "vitest";
import {
  addCivilDays,
  annualDueDay,
  clampDayToMonth,
  generateRecurringDueDates,
} from "@/lib/finance/recurring-schedule";

describe("recurring-schedule", () => {
  it("mensal dia 31 usa último dia em fevereiro", () => {
    const dates = generateRecurringDueDates({
      frequency: "MONTHLY",
      start: { year: 2026, month: 1, day: 31 },
      dueDayOfMonth: 31,
      maxOccurrences: 3,
    });
    expect(dates[0]).toEqual({ year: 2026, month: 1, day: 31 });
    expect(dates[1]).toEqual({ year: 2026, month: 2, day: 28 });
    expect(dates[2]).toEqual({ year: 2026, month: 3, day: 31 });
  });

  it("anual 29 fevereiro → 28 em ano não bissexto", () => {
    const d = annualDueDay({ year: 2024, month: 2, day: 29 }, 2025);
    expect(d).toEqual({ year: 2025, month: 2, day: 28 });
  });

  it("anual 29 fevereiro mantém 29 em bissexto", () => {
    const d = annualDueDay({ year: 2024, month: 2, day: 29 }, 2028);
    expect(d).toEqual({ year: 2028, month: 2, day: 29 });
  });

  it("trimestral avança três meses", () => {
    const dates = generateRecurringDueDates({
      frequency: "QUARTERLY",
      start: { year: 2026, month: 1, day: 10 },
      dueDayOfMonth: 10,
      maxOccurrences: 2,
    });
    expect(dates[1]).toEqual({ year: 2026, month: 4, day: 10 });
  });

  it("semestral avança seis meses", () => {
    const dates = generateRecurringDueDates({
      frequency: "SEMIANNUAL",
      start: { year: 2026, month: 3, day: 5 },
      dueDayOfMonth: 5,
      maxOccurrences: 2,
    });
    expect(dates[1]).toEqual({ year: 2026, month: 9, day: 5 });
  });

  it("semanal incrementa 7 dias civis", () => {
    const start = { year: 2026, month: 10, day: 1 };
    const dates = generateRecurringDueDates({
      frequency: "WEEKLY",
      start,
      maxOccurrences: 2,
    });
    expect(dates[1]).toEqual(addCivilDays(start, 7));
  });

  it("respeita data de fim", () => {
    const dates = generateRecurringDueDates({
      frequency: "MONTHLY",
      start: { year: 2026, month: 1, day: 5 },
      dueDayOfMonth: 5,
      end: { year: 2026, month: 2, day: 5 },
      maxOccurrences: 12,
    });
    expect(dates.length).toBe(2);
  });

  it("clampDayToMonth", () => {
    expect(clampDayToMonth(2026, 4, 31)).toBe(30);
  });
});
