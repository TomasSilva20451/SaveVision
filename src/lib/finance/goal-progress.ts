import { decimal } from "@/lib/finance/money";
import type Decimal from "decimal.js";

export function sumContributions(
  amounts: readonly string[],
): Decimal {
  return amounts.reduce((sum, value) => sum.plus(value), decimal(0));
}

export type GoalFundingSnapshot = {
  currentAmount: string;
  recordedContributions: string;
  netWithdrawn: string;
  usesLinkedAccountBalance: boolean;
};

/**
 * A linked account is the source of truth for money that is still reserved.
 * Contribution rows remain an immutable history and must not hide later
 * withdrawals from that account.
 */
export function goalFundingSnapshot(
  contributionAmounts: readonly string[],
  linkedAccountBalance?: string | null,
): GoalFundingSnapshot {
  const recorded = sumContributions(contributionAmounts);
  const usesLinkedAccountBalance = linkedAccountBalance != null;
  const rawCurrent = usesLinkedAccountBalance
    ? decimal(linkedAccountBalance)
    : recorded;
  const current = rawCurrent.lt(0) ? decimal(0) : rawCurrent;
  const withdrawn = recorded.minus(current);

  return {
    currentAmount: current.toFixed(2),
    recordedContributions: recorded.toFixed(2),
    netWithdrawn: withdrawn.gt(0) ? withdrawn.toFixed(2) : "0.00",
    usesLinkedAccountBalance,
  };
}

export function goalProgressPercent(
  contributed: string,
  target: string,
): number | null {
  const targetDec = decimal(target);
  if (targetDec.lte(0)) return null;
  const ratio = decimal(contributed).div(targetDec).times(100);
  const clamped = ratio.gt(100) ? decimal(100) : ratio;
  return clamped.toDecimalPlaces(1).toNumber();
}

export function emergencyFundTargetAmount(
  monthlyEssentialExpenses: string,
  targetMonths: number,
): string {
  return decimal(monthlyEssentialExpenses)
    .times(targetMonths)
    .toFixed(2);
}
