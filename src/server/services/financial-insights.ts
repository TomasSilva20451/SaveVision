import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { civilDateFromInstant, isInstantInCivilMonth } from "@/lib/datetime/civil-date";
import { calculateAccountBalance, calculateCashFlow } from "@/lib/finance/aggregates";
import {
  buildFinancialInsights,
  pickTopInsights,
  type ExpenseMovementSnapshot,
  type FinancialInsight,
} from "@/lib/finance/financial-insights";
import { decimal } from "@/lib/finance/money";
import type { LedgerMovement } from "@/lib/finance/types";
import {
  buildTreasuryProjection,
  sumStartingBalance,
  treasuryHorizonEnd,
  treasuryHorizonStart,
} from "@/lib/finance/treasury-forecast";
import { db } from "@/lib/db";
import { listWorkspaceMovements } from "@/server/repositories/ledger";
import { collectTreasuryForecastEvents } from "@/server/services/treasury-forecast";

function toMovement(tx: {
  accountId: string;
  type: LedgerMovement["type"];
  status: LedgerMovement["status"];
  amount: { toString(): string };
  deletedAt: Date | null;
}): LedgerMovement {
  return {
    accountId: tx.accountId,
    type: tx.type,
    status: tx.status,
    amount: tx.amount.toString(),
    deletedAt: tx.deletedAt,
  };
}

function sumCompleted(
  rows: readonly {
    type: string;
    status: string;
    occurredAt: Date;
    amount: { toString(): string };
  }[],
  year: number,
  month: number,
  type: "INCOME" | "EXPENSE",
): string {
  return rows
    .filter(
      (t) =>
        t.type === type &&
        t.status === "COMPLETED" &&
        isInstantInCivilMonth(t.occurredAt, year, month),
    )
    .reduce((s, t) => {
      const abs = type === "EXPENSE" ? decimal(t.amount.toString()).abs() : decimal(t.amount.toString());
      return s.plus(abs);
    }, decimal(0))
    .toFixed(2);
}

export async function getFinancialInsightsOverview(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const civil = civilDateFromInstant(new Date());
  const year = civil.year;
  const month = civil.month;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const [transactions, rawMovements, budget, recurring, accounts] = await Promise.all([
    db.transaction.findMany({
      where: { workspaceId, deletedAt: null },
      include: { category: true },
      orderBy: { occurredAt: "asc" },
    }),
    listWorkspaceMovements(workspaceId),
    db.monthlyBudget.findUnique({
      where: { workspaceId_year_month: { workspaceId, year, month } },
      include: { lines: { include: { category: true } } },
    }),
    db.recurringExpense.findMany({ where: { workspaceId } }),
    db.financialAccount.findMany({ where: { workspaceId, isArchived: false } }),
  ]);

  const expenseMovements: ExpenseMovementSnapshot[] = transactions
    .filter((tx) => tx.type === "EXPENSE" && tx.status === "COMPLETED")
    .map((tx) => ({
      occurredAt: tx.occurredAt,
      amount: tx.amount.toString(),
      categoryId: tx.categoryId ?? "uncategorized",
      categoryName: tx.category?.name ?? "Sem categoria",
    }));

  const incomeMonth = sumCompleted(transactions, year, month, "INCOME");
  const incomePreviousMonth = sumCompleted(transactions, prevYear, prevMonth, "INCOME");
  const expenseMonth = sumCompleted(transactions, year, month, "EXPENSE");
  const expensePreviousMonth = sumCompleted(transactions, prevYear, prevMonth, "EXPENSE");

  const monthMovements = transactions
    .filter((t) => t.status === "COMPLETED" && isInstantInCivilMonth(t.occurredAt, year, month))
    .map(toMovement);
  const prevMovements = transactions
    .filter(
      (t) => t.status === "COMPLETED" && isInstantInCivilMonth(t.occurredAt, prevYear, prevMonth),
    )
    .map(toMovement);

  const economicResultMonth = calculateCashFlow(monthMovements).toFixed(2);

  const spentMap = new Map<string, string>();
  for (const tx of transactions) {
    if (tx.type !== "EXPENSE" || tx.status !== "COMPLETED") continue;
    if (!isInstantInCivilMonth(tx.occurredAt, year, month)) continue;
    const cid = tx.categoryId ?? "uncategorized";
    const prev = spentMap.get(cid) ?? "0";
    spentMap.set(cid, decimal(prev).plus(decimal(tx.amount.toString()).abs()).toFixed(2));
  }

  const budgetLines =
    budget?.lines.map((line) => ({
      categoryId: line.categoryId,
      categoryName: line.category.name,
      limitAmount: line.limitAmount.toString(),
      spentAmount: spentMap.get(line.categoryId) ?? "0.00",
    })) ?? [];

  const asOf = new Date();
  const forecastEvents = await collectTreasuryForecastEvents(
    workspaceId,
    treasuryHorizonStart(asOf),
    treasuryHorizonEnd(asOf, 7),
  );
  const balances = accounts.map((a) =>
    calculateAccountBalance(a.openingBalance.toString(), rawMovements, a.id).toFixed(2),
  );
  const weekProjection = buildTreasuryProjection({
    startingBalance: sumStartingBalance(balances),
    events: forecastEvents,
    horizonDays: 7,
    asOf,
  });

  const savingsRateCurrent = decimal(incomeMonth).gt(0)
    ? calculateCashFlow(monthMovements).div(incomeMonth).times(100).toNumber()
    : null;
  const savingsRatePrevious = decimal(incomePreviousMonth).gt(0)
    ? calculateCashFlow(prevMovements).div(incomePreviousMonth).times(100).toNumber()
    : null;

  const bundle = buildFinancialInsights({
    workspaceId,
    civilYear: year,
    civilMonth: month,
    expenseMovements,
    incomeMonth,
    incomePreviousMonth,
    expenseMonth,
    expensePreviousMonth,
    economicResultMonth,
    budgetLines,
    subscriptions: recurring.map((r) => ({
      id: r.id,
      name: r.name,
      expectedAmount: r.expectedAmount.toString(),
      frequency: r.frequency,
      status: r.status,
    })),
    upcomingWeekOutflows: weekProjection.expectedOutflows,
    savingsRateCurrent,
    savingsRatePrevious,
  });

  return {
    summary: bundle.summary,
    insights: bundle.insights,
    highlights: pickTopInsights(bundle.insights, 4),
  };
}

export type FinancialInsightsOverview = NonNullable<
  Awaited<ReturnType<typeof getFinancialInsightsOverview>>
>;

export type { FinancialInsight };
