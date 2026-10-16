import { decimal } from "@/lib/finance/money";

export type BudgetLineSnapshot = {
  categoryId: string;
  categoryName: string;
  limitAmount: string;
  spentAmount: string;
};

export function budgetAvailable(limit: string, spent: string): string {
  return decimal(limit).minus(spent).toFixed(2);
}

export function budgetUtilizationPercent(
  limit: string,
  spent: string,
): number | null {
  const limitDec = decimal(limit);
  if (limitDec.lte(0)) return null;
  const ratio = decimal(spent).div(limitDec).times(100);
  return ratio.toDecimalPlaces(1).toNumber();
}

export function budgetOverage(limit: string, spent: string): string {
  const diff = decimal(spent).minus(limit);
  return diff.gt(0) ? diff.toFixed(2) : "0.00";
}

export function summarizeBudgetMonth(lines: BudgetLineSnapshot[]) {
  const totalLimit = lines.reduce(
    (sum, line) => sum.plus(line.limitAmount),
    decimal(0),
  );
  const totalSpent = lines.reduce(
    (sum, line) => sum.plus(line.spentAmount),
    decimal(0),
  );
  return {
    totalLimit: totalLimit.toFixed(2),
    totalSpent: totalSpent.toFixed(2),
    totalAvailable: budgetAvailable(totalLimit.toFixed(2), totalSpent.toFixed(2)),
    utilizationPercent: budgetUtilizationPercent(
      totalLimit.toFixed(2),
      totalSpent.toFixed(2),
    ),
  };
}
