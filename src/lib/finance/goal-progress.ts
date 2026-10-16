import { decimal } from "@/lib/finance/money";
import type Decimal from "decimal.js";

export function sumContributions(
  amounts: readonly string[],
): Decimal {
  return amounts.reduce((sum, value) => sum.plus(value), decimal(0));
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
