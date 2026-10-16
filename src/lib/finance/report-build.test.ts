import { describe, expect, it } from "vitest";
import {
  reportOpeningClosing,
  reportTotals,
  splitMovementsByPeriod,
  type TimedMovement,
} from "@/lib/finance/report-build";
import { buildReportPeriod } from "@/lib/finance/report-period";
import type { AccountSnapshot } from "@/lib/finance/types";

const accounts: AccountSnapshot[] = [
  {
    id: "a1",
    openingBalance: "1000",
    type: "CURRENT",
    isIncludedInNetWorth: true,
    isArchived: false,
  },
];

describe("report-build", () => {
  it("calcula saldo inicial e final no período", () => {
    const period = buildReportPeriod(
      { year: 2026, month: 1, day: 1 },
      { year: 2026, month: 1, day: 31 },
    );
    const movements: TimedMovement[] = [
      {
        accountId: "a1",
        type: "INCOME",
        status: "COMPLETED",
        amount: "100",
        occurredAt: new Date("2026-01-10T12:00:00.000Z"),
      },
    ];
    const { beforePeriod, inPeriod } = splitMovementsByPeriod(movements, period);
    expect(beforePeriod).toHaveLength(0);
    expect(inPeriod).toHaveLength(1);
    const totals = reportTotals(inPeriod);
    expect(totals.income).toBe("100.00");
    const balances = reportOpeningClosing(accounts, beforePeriod, inPeriod);
    expect(balances.opening).toBe("1000.00");
    expect(balances.closing).toBe("1100.00");
  });
});
