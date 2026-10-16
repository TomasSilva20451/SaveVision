import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  civilDateFromInstant,
  isInstantInCivilMonth,
} from "@/lib/datetime/civil-date";
import { calculateExpenses } from "@/lib/finance/aggregates";
import { decimal } from "@/lib/finance/money";
import { safePercentChange } from "@/lib/finance/kpi";
import type { LedgerMovement } from "@/lib/finance/types";
import { db } from "@/lib/db";

function toMovement(tx: {
  accountId: string;
  type: string;
  status: string;
  amount: { toString(): string };
  deletedAt: Date | null;
}): LedgerMovement {
  return {
    accountId: tx.accountId,
    type: tx.type as LedgerMovement["type"],
    status: tx.status as LedgerMovement["status"],
    amount: tx.amount.toString(),
    deletedAt: tx.deletedAt,
  };
}

export async function getExpenseAnalysis(
  userId: string,
  workspaceId: string,
  year: number,
  month: number,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const transactions = await db.transaction.findMany({
    where: { workspaceId, deletedAt: null, type: "EXPENSE", status: "COMPLETED" },
    include: { category: true },
  });

  const monthTx = transactions.filter((tx) =>
    isInstantInCivilMonth(tx.occurredAt, year, month),
  );
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevTx = transactions.filter((tx) =>
    isInstantInCivilMonth(tx.occurredAt, prevYear, prevMonth),
  );

  const monthMovements = monthTx.map(toMovement);
  const prevMovements = prevTx.map(toMovement);
  const totalMonth = calculateExpenses(monthMovements).toFixed(2);
  const totalPrev = calculateExpenses(prevMovements).toFixed(2);

  const byCategory = new Map<string, { name: string; total: string }>();
  for (const tx of monthTx) {
    const id = tx.categoryId ?? "none";
    const name = tx.category?.name ?? "Sem categoria";
    const amount = decimal(tx.amount.toString()).abs();
    const prev = byCategory.get(id);
    byCategory.set(id, {
      name,
      total: prev
        ? decimal(prev.total).plus(amount).toFixed(2)
        : amount.toFixed(2),
    });
  }

  const monthlyTotals: { year: number; month: number; total: string }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    let m = month - i;
    let y = year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const slice = transactions.filter((tx) => isInstantInCivilMonth(tx.occurredAt, y, m));
    monthlyTotals.push({
      year: y,
      month: m,
      total: calculateExpenses(slice.map(toMovement)).toFixed(2),
    });
  }

  const monthsWithData = monthlyTotals.filter((row) => decimal(row.total).gt(0));
  const averageMonthly =
    monthsWithData.length > 0
      ? monthsWithData
          .reduce((sum, row) => sum.plus(row.total), decimal(0))
          .div(monthsWithData.length)
          .toFixed(2)
      : "0.00";

  return {
    year,
    month,
    totalMonth,
    totalPrev,
    monthChangePercent: safePercentChange(totalMonth, totalPrev),
    averageMonthly,
    byCategory: [...byCategory.entries()].map(([categoryId, value]) => ({
      categoryId,
      ...value,
    })),
    monthlyTotals,
    hasEnoughHistory: monthsWithData.length >= 2,
    civilLabel: civilDateFromInstant(new Date()),
  };
}
