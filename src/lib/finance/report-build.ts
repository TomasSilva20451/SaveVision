import {
  calculateAccountBalance,
  calculateCashFlow,
  calculateExpenses,
  calculateIncome,
  calculateNetWorth,
} from "@/lib/finance/aggregates";
import { decimal } from "@/lib/finance/money";
import type { AccountSnapshot, LedgerMovement } from "@/lib/finance/types";
import {
  isInstantInReportPeriod,
  type ReportPeriod,
} from "@/lib/finance/report-period";

export type TimedMovement = LedgerMovement & { occurredAt: Date };

export function splitMovementsByPeriod(
  movements: TimedMovement[],
  period: ReportPeriod,
) {
  const beforePeriod = movements.filter((m) => m.occurredAt < period.fromInstant);
  const inPeriod = movements.filter((m) =>
    isInstantInReportPeriod(m.occurredAt, period),
  );
  return { beforePeriod, inPeriod };
}

export function sumWorkspaceBalances(
  accounts: AccountSnapshot[],
  movements: LedgerMovement[],
): string {
  return accounts
    .reduce((sum, account) => {
      const balance = calculateAccountBalance(
        account.openingBalance,
        movements,
        account.id,
      );
      return sum.plus(balance);
    }, decimal(0))
    .toFixed(2);
}

export function reportTotals(inPeriod: LedgerMovement[]) {
  const income = calculateIncome(inPeriod);
  const expenses = calculateExpenses(inPeriod);
  const cashFlow = calculateCashFlow(inPeriod);
  const transferVolume = inPeriod
    .filter(
      (m) =>
        m.type === "TRANSFER" &&
        m.status === "COMPLETED" &&
        decimal(m.amount).gt(0),
    )
    .reduce((sum, m) => sum.plus(m.amount), decimal(0));

  return {
    income: income.toFixed(2),
    expenses: expenses.toFixed(2),
    cashFlow: cashFlow.toFixed(2),
    transferVolume: transferVolume.toFixed(2),
  };
}

export function reportOpeningClosing(
  accounts: AccountSnapshot[],
  beforePeriod: LedgerMovement[],
  inPeriod: LedgerMovement[],
) {
  const opening = sumWorkspaceBalances(accounts, beforePeriod);
  const closing = sumWorkspaceBalances(accounts, [...beforePeriod, ...inPeriod]);
  const netWorthOpening = calculateNetWorth(accounts, beforePeriod).toFixed(2);
  const netWorthClosing = calculateNetWorth(accounts, [
    ...beforePeriod,
    ...inPeriod,
  ]).toFixed(2);
  return { opening, closing, netWorthOpening, netWorthClosing };
}
