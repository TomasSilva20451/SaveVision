import { describe, expect, it } from "vitest";
import { buildReportPeriod, isFullCivilMonthPeriod, reportPeriodKey } from "@/lib/finance/report-period";

describe("report-period narrative helpers", () => {
  it("detecta mês civil completo", () => {
    const period = buildReportPeriod({ year: 2026, month: 10, day: 1 }, { year: 2026, month: 10, day: 31 });
    expect(isFullCivilMonthPeriod(period)).toBe(true);
    expect(reportPeriodKey(period)).toBe("2026-10");
  });

  it("rejeita intervalo parcial", () => {
    const period = buildReportPeriod({ year: 2026, month: 10, day: 1 }, { year: 2026, month: 10, day: 21 });
    expect(isFullCivilMonthPeriod(period)).toBe(false);
  });
});
