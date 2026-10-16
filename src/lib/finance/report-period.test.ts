import { describe, expect, it } from "vitest";
import {
  buildReportPeriod,
  isInstantInReportPeriod,
  parseCivilDateParam,
} from "@/lib/finance/report-period";
import { zonedDateTimeToInstant } from "@/lib/datetime/civil-date";

describe("report-period", () => {
  it("valida parâmetros ISO", () => {
    expect(parseCivilDateParam("2026-03-01")).toEqual({
      year: 2026,
      month: 3,
      day: 1,
    });
    expect(parseCivilDateParam("bad")).toBeNull();
  });

  it("filtra instantes no intervalo civil", () => {
    const period = buildReportPeriod(
      { year: 2026, month: 3, day: 1 },
      { year: 2026, month: 3, day: 31 },
    );
    const inside = zonedDateTimeToInstant(
      { year: 2026, month: 3, day: 15 },
      { hour: 12, minute: 0 },
    );
    expect(isInstantInReportPeriod(inside, period)).toBe(true);
  });
});
