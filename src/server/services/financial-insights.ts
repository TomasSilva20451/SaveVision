import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { civilDateFromInstant, isInstantInCivilMonth } from "@/lib/datetime/civil-date";
import {
  calculateAccountBalance,
  calculateCashFlow,
  calculateNetCashMovement,
} from "@/lib/finance/aggregates";
import {
  analysisSavingsRate,
  averageDailyExpense,
  budgetCompliancePercent,
  buildFinancialInsights,
  essentialityRatio,
  pickTopInsights,
  type ExpenseMovementSnapshot,
  type FinancialInsight,
} from "@/lib/finance/financial-insights";
import { decimal } from "@/lib/finance/money";
import { safePercentChange } from "@/lib/finance/kpi";
import { positionMarketValue } from "@/lib/finance/investments";
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

export type AnalysisPeriod = "3" | "6" | "12" | "year";

type MonthKey = { year: number; month: number };

function shiftMonth(year: number, month: number, delta: number): MonthKey {
  const index = year * 12 + month - 1 + delta;
  return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 };
}

function analysisMonths(year: number, month: number, period: AnalysisPeriod): MonthKey[] {
  const count = period === "year" ? month : Number(period);
  const first = period === "year" ? { year, month: 1 } : shiftMonth(year, month, -(count - 1));
  return Array.from({ length: count }, (_, index) => shiftMonth(first.year, first.month, index));
}

function monthId(value: MonthKey): string {
  return `${value.year}-${String(value.month).padStart(2, "0")}`;
}

function monthLabel(value: MonthKey): string {
  return new Intl.DateTimeFormat("pt-PT", { month: "short", year: "2-digit", timeZone: "Europe/Lisbon" })
    .format(new Date(Date.UTC(value.year, value.month - 1, 15)))
    .replace(".", "");
}

function isInMonths(date: Date, months: readonly MonthKey[]): boolean {
  const civil = civilDateFromInstant(date);
  return months.some((item) => item.year === civil.year && item.month === civil.month);
}

export async function getFinancialInsightsOverview(
  userId: string,
  workspaceId: string,
  period: AnalysisPeriod = "6",
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const civil = civilDateFromInstant(new Date());
  const year = civil.year;
  const month = civil.month;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const [transactions, rawMovements, budget, recurring, accounts, positions, snapshots] = await Promise.all([
    db.transaction.findMany({
      where: { workspaceId, deletedAt: null },
      include: { category: true, incomeOccurrence: true },
      orderBy: { occurredAt: "asc" },
    }),
    listWorkspaceMovements(workspaceId),
    db.monthlyBudget.findUnique({
      where: { workspaceId_year_month: { workspaceId, year, month } },
      include: { lines: { include: { category: true } } },
    }),
    db.recurringExpense.findMany({ where: { workspaceId } }),
    db.financialAccount.findMany({ where: { workspaceId, isArchived: false } }),
    db.investmentPosition.findMany({ where: { workspaceId } }),
    db.netWorthSnapshot.findMany({
      where: { workspaceId },
      orderBy: { asOfDate: "asc" },
      take: 36,
    }),
  ]);

  const expenseMovements: ExpenseMovementSnapshot[] = transactions
    .filter((tx) => tx.type === "EXPENSE" && tx.status === "COMPLETED")
    .map((tx) => ({
      id: tx.id,
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

  const months = analysisMonths(year, month, period);
  const previousMonths = months.map((_, index) => {
    const first = months[0]!;
    return shiftMonth(first.year, first.month, index - months.length);
  });
  const homologousMonths = months.map((item) => ({ year: item.year - 1, month: item.month }));
  const completed = transactions.filter((row) => row.status === "COMPLETED");
  const periodRows = completed.filter((row) => isInMonths(row.occurredAt, months));
  const previousRows = completed.filter((row) => isInMonths(row.occurredAt, previousMonths));
  const homologousRows = completed.filter((row) => isInMonths(row.occurredAt, homologousMonths));
  const periodMovements = periodRows.map(toMovement);
  const previousMovementsPeriod = previousRows.map(toMovement);
  const homologousMovements = homologousRows.map(toMovement);
  const periodIncome = periodRows.filter((row) => row.type === "INCOME").reduce((sum, row) => sum.plus(row.amount.toString()), decimal(0));
  const periodExpense = periodRows.filter((row) => row.type === "EXPENSE").reduce((sum, row) => sum.plus(decimal(row.amount.toString()).abs()), decimal(0));
  const previousIncome = previousRows.filter((row) => row.type === "INCOME").reduce((sum, row) => sum.plus(row.amount.toString()), decimal(0));
  const previousExpense = previousRows.filter((row) => row.type === "EXPENSE").reduce((sum, row) => sum.plus(decimal(row.amount.toString()).abs()), decimal(0));
  const periodResult = calculateCashFlow(periodMovements);
  const previousResult = calculateCashFlow(previousMovementsPeriod);
  const periodSavingsRate = analysisSavingsRate(periodIncome.toString(), periodResult.toString());
  const previousSavingsRate = analysisSavingsRate(previousIncome.toString(), previousResult.toString());
  const firstMonth = months[0]!;
  const observedDays = Math.max(1, Math.floor((Date.UTC(year, month - 1, civil.day) - Date.UTC(firstMonth.year, firstMonth.month - 1, 1)) / 86_400_000) + 1);

  const monthly = months.map((item) => {
    const rows = completed.filter((row) => isInstantInCivilMonth(row.occurredAt, item.year, item.month));
    const movements = rows.map(toMovement);
    const income = rows.filter((row) => row.type === "INCOME").reduce((sum, row) => sum.plus(row.amount.toString()), decimal(0));
    const expense = rows.filter((row) => row.type === "EXPENSE").reduce((sum, row) => sum.plus(decimal(row.amount.toString()).abs()), decimal(0));
    const result = calculateCashFlow(movements);
    return {
      id: monthId(item),
      label: monthLabel(item),
      income: income.toFixed(2),
      expense: expense.toFixed(2),
      savingsRate: income.gt(0) ? result.div(income).times(100).toDecimalPlaces(1).toNumber() : null,
      cashMovement: calculateNetCashMovement(movements).toFixed(2),
    };
  });
  let cumulativeCash = decimal(0);
  const monthlyWithCash = monthly.map((item) => {
    cumulativeCash = cumulativeCash.plus(item.cashMovement);
    return { ...item, cumulativeCashMovement: cumulativeCash.toFixed(2) };
  });

  const categoryMap = new Map<string, { name: string; nature: string; amount: ReturnType<typeof decimal> }>();
  const previousCategoryMap = new Map<string, ReturnType<typeof decimal>>();
  for (const row of periodRows.filter((item) => item.type === "EXPENSE")) {
    const id = row.categoryId ?? "uncategorized";
    const current = categoryMap.get(id);
    categoryMap.set(id, {
      name: row.category?.name ?? "Sem categoria",
      nature: row.category?.nature ?? "UNCLASSIFIED",
      amount: (current?.amount ?? decimal(0)).plus(decimal(row.amount.toString()).abs()),
    });
  }
  for (const row of previousRows.filter((item) => item.type === "EXPENSE")) {
    const id = row.categoryId ?? "uncategorized";
    previousCategoryMap.set(id, (previousCategoryMap.get(id) ?? decimal(0)).plus(decimal(row.amount.toString()).abs()));
  }
  const categories = [...categoryMap.entries()]
    .map(([id, row]) => {
      const previous = previousCategoryMap.get(id);
      return {
        id,
        name: row.name,
        nature: row.nature,
        amount: row.amount.toFixed(2),
        previousAmount: previous?.toFixed(2) ?? null,
        changePercent: previous && previous.gt(0) ? safePercentChange(row.amount.toString(), previous.toString()) : null,
      };
    })
    .sort((a, b) => decimal(b.amount).comparedTo(a.amount));
  const essentialTotal = categories.filter((row) => row.nature === "NECESSARY").reduce((sum, row) => sum.plus(row.amount), decimal(0));
  const periodEssentialityRatio = essentialityRatio(essentialTotal.toString(), periodExpense.toString());

  const budgets = budgetLines.map((line) => ({
    ...line,
    difference: decimal(line.limitAmount).minus(line.spentAmount).toFixed(2),
    utilizationPercent: decimal(line.limitAmount).gt(0) ? decimal(line.spentAmount).div(line.limitAmount).times(100).toDecimalPlaces(1).toNumber() : null,
  }));
  const periodBudgetCompliancePercent = budgetCompliancePercent(budgets);

  const incomeOriginMap = new Map<string, ReturnType<typeof decimal>>();
  for (const row of periodRows.filter((item) => item.type === "INCOME")) {
    const label = row.incomeOccurrence?.sourceType?.replaceAll("_", " ") ?? row.category?.name ?? "Outras receitas";
    incomeOriginMap.set(label, (incomeOriginMap.get(label) ?? decimal(0)).plus(row.amount.toString()));
  }
  const incomeOrigins = [...incomeOriginMap.entries()].map(([name, amount]) => ({ name, amount: amount.toFixed(2) })).sort((a, b) => decimal(b.amount).comparedTo(a.amount));
  const homologousIncome = homologousRows.filter((row) => row.type === "INCOME").reduce((sum, row) => sum.plus(row.amount.toString()), decimal(0));
  const homologousExpense = homologousRows.filter((row) => row.type === "EXPENSE").reduce((sum, row) => sum.plus(decimal(row.amount.toString()).abs()), decimal(0));
  const homologousResult = calculateCashFlow(homologousMovements);
  const standaloneInvestmentTotal = positions.filter((row) => row.valuationMode !== "ACCOUNT_COMPONENT" && !row.linkedAccountId).reduce((sum, row) => sum.plus(positionMarketValue(row.quantity.toString(), row.manualPrice.toString())), decimal(0));

  return {
    summary: bundle.summary,
    insights: bundle.insights,
    highlights: pickTopInsights(bundle.insights, 4),
    analytics: {
      period,
      periodLabel: period === "year" ? "Este ano" : `Últimos ${period} meses`,
      observedDays,
      income: periodIncome.toFixed(2),
      expense: periodExpense.toFixed(2),
      economicResult: periodResult.toFixed(2),
      savingsRate: periodSavingsRate,
      savingsRateChangePoints: periodSavingsRate != null && previousSavingsRate != null ? Math.round((periodSavingsRate - previousSavingsRate) * 10) / 10 : null,
      averageDailyExpense: averageDailyExpense(periodExpense.toString(), observedDays),
      essentialityRatio: periodEssentialityRatio,
      budgetCompliancePercent: periodBudgetCompliancePercent,
      monthly: monthlyWithCash,
      categories,
      budgets,
      incomeOrigins,
      comparison: {
        previous: {
          income: previousIncome.toFixed(2),
          expense: previousExpense.toFixed(2),
          economicResult: previousResult.toFixed(2),
        },
        homologous: {
          available: homologousRows.length > 0,
          income: homologousIncome.toFixed(2),
          expense: homologousExpense.toFixed(2),
          economicResult: homologousResult.toFixed(2),
        },
      },
      investments: {
        currentStandaloneValue: standaloneInvestmentTotal.toFixed(2),
        positionCount: positions.length,
      },
      patrimonySnapshots: snapshots.map((row) => ({
        date: row.asOfDate.toISOString(),
        netWorth: row.netWorth.toString(),
        assets: decimal(row.cashTotal.toString()).plus(row.savingsTotal.toString()).plus(row.investmentsTotal.toString()).plus(row.manualAssetsTotal.toString()).toFixed(2),
        liabilities: row.liabilitiesTotal.toString(),
      })),
    },
  };
}

export type FinancialInsightsOverview = NonNullable<
  Awaited<ReturnType<typeof getFinancialInsightsOverview>>
>;

export type { FinancialInsight };
