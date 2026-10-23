import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  civilDateFromInstant,
  isInstantInCivilMonth,
  startOfNextCivilMonth,
} from "@/lib/datetime/civil-date";
import {
  calculateAccountBalance,
  calculateCashFlow,
  calculateExpectedIncome,
  calculateExpenses,
  calculateIncome,
  calculateNetCashMovement,
  calculateNetWorth,
} from "@/lib/finance/aggregates";
import { decimal } from "@/lib/finance/money";
import type { LedgerMovement } from "@/lib/finance/types";
import { db } from "@/lib/db";
import { listWorkspaceMovements } from "@/server/repositories/ledger";
import { summarizeBudgetMonth } from "@/lib/finance/budget";
import { calculatePatrimonyNet } from "@/lib/finance/patrimony";
import { getTreasuryForecastAllHorizons } from "@/server/services/treasury-forecast";

function txToMovement(tx: {
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

const MONTH_LABELS_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

function balanceAtCutoff(
  accounts: { id: string; openingBalance: { toString(): string } }[],
  transactions: {
    accountId: string;
    type: LedgerMovement["type"];
    status: LedgerMovement["status"];
    amount: { toString(): string };
    deletedAt: Date | null;
    occurredAt: Date;
  }[],
  cutoff: Date,
): string {
  const slice = transactions
    .filter((tx) => tx.occurredAt < cutoff)
    .map((tx) =>
      txToMovement({
        accountId: tx.accountId,
        type: tx.type,
        status: tx.status,
        amount: tx.amount,
        deletedAt: tx.deletedAt,
      }),
    );

  return accounts
    .map((account) =>
      calculateAccountBalance(account.openingBalance.toString(), slice, account.id),
    )
    .reduce((sum, value) => sum.plus(value), decimal(0))
    .toFixed(2);
}

function buildBalanceSeries(
  accounts: { id: string; openingBalance: { toString(): string } }[],
  transactions: {
    accountId: string;
    type: LedgerMovement["type"];
    status: LedgerMovement["status"];
    amount: { toString(): string };
    deletedAt: Date | null;
    occurredAt: Date;
  }[],
  months: number,
) {
  const now = civilDateFromInstant(new Date());
  const points: { label: string; balance: number }[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    let month = now.month - offset;
    let year = now.year;
    while (month < 1) {
      month += 12;
      year -= 1;
    }
    const cutoff = startOfNextCivilMonth(year, month);
    const balance = balanceAtCutoff(accounts, transactions, cutoff);
    points.push({
      label: MONTH_LABELS_PT[month - 1] ?? String(month),
      balance: Number(balance),
    });
  }

  return points;
}

function buildIncomeCategoryBreakdown(
  transactions: {
    type: string;
    amount: { toString(): string };
    category: { name: string } | null;
  }[],
) {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== "INCOME") continue;
    const name = tx.category?.name ?? "Outros";
    const prev = map.get(name) ?? 0;
    map.set(name, prev + Math.abs(Number(tx.amount.toString())));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getDashboardMetrics(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const civil = civilDateFromInstant(new Date());
  const year = civil.year;
  const month = civil.month;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const thirtyDaysAhead = new Date(Date.now() + 30 * 86_400_000);

  const [
    accounts,
    rawMovements,
    transactions,
    expectedRows,
    budget,
    liabilities,
    positions,
    recurringDue30,
    recurringExpectedMonthRows,
    upcomingRecurring,
    treasuryHorizons,
  ] = await Promise.all([
    db.financialAccount.findMany({
      where: { workspaceId, isArchived: false },
    }),
    listWorkspaceMovements(workspaceId),
    db.transaction.findMany({
      where: { workspaceId, deletedAt: null },
      include: { category: true },
      orderBy: { occurredAt: "asc" },
    }),
    db.incomeOccurrence.findMany({
      where: { workspaceId, status: "EXPECTED" },
    }),
    db.monthlyBudget.findUnique({
      where: { workspaceId_year_month: { workspaceId, year, month } },
      include: { lines: { include: { category: true } } },
    }),
    db.financialLiability.findMany({ where: { workspaceId } }),
    db.investmentPosition.findMany({ where: { workspaceId } }),
    db.recurringExpenseOccurrence.findMany({
      where: {
        workspaceId,
        status: { in: ["EXPECTED", "POSTPONED"] },
        dueDate: { gte: new Date(), lte: thirtyDaysAhead },
      },
    }),
    db.recurringExpenseOccurrence.findMany({
      where: {
        workspaceId,
        status: { in: ["EXPECTED", "POSTPONED", "PAID"] },
      },
    }),
    db.recurringExpenseOccurrence.findMany({
      where: {
        workspaceId,
        status: { in: ["EXPECTED", "POSTPONED"] },
        dueDate: { gte: new Date() },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: { recurringExpense: { select: { name: true } } },
    }),
    getTreasuryForecastAllHorizons(userId, workspaceId),
  ]);

  const accountSnapshots = accounts.map((account) => ({
    id: account.id,
    openingBalance: account.openingBalance.toString(),
    type: account.type,
    isIncludedInNetWorth: account.isIncludedInNetWorth,
    isArchived: account.isArchived,
  }));

  const totalBalance = accounts
    .map((account) =>
      calculateAccountBalance(
        account.openingBalance.toString(),
        rawMovements,
        account.id,
      ),
    )
    .reduce((sum, value) => sum.plus(value), decimal(0));

  const savingsBalance = accounts
    .filter((account) => account.type === "SAVINGS")
    .map((account) =>
      calculateAccountBalance(
        account.openingBalance.toString(),
        rawMovements,
        account.id,
      ),
    )
    .reduce((sum, value) => sum.plus(value), decimal(0));

  const availableBalance = accounts
    .filter((account) => account.type === "CURRENT")
    .map((account) =>
      calculateAccountBalance(
        account.openingBalance.toString(),
        rawMovements,
        account.id,
      ),
    )
    .reduce((sum, value) => sum.plus(value), decimal(0));

  const monthTx = transactions.filter((tx) =>
    isInstantInCivilMonth(tx.occurredAt, year, month),
  );
  const prevTx = transactions.filter((tx) =>
    isInstantInCivilMonth(tx.occurredAt, prevYear, prevMonth),
  );

  const monthMovements = monthTx.map(txToMovement);
  const prevMovements = prevTx.map(txToMovement);

  const expectedFromOccurrences = expectedRows.reduce(
    (sum, row) => sum.plus(row.expectedAmount.toString()),
    decimal(0),
  );

  const budgetLines = budget
    ? await (async () => {
        const spentMap = new Map<string, string>();
        for (const tx of monthTx) {
          if (tx.type !== "EXPENSE" || tx.status !== "COMPLETED") continue;
          const categoryId = tx.categoryId ?? "uncategorized";
          const add = decimal(tx.amount.toString()).abs().toFixed(2);
          const prev = spentMap.get(categoryId);
          spentMap.set(
            categoryId,
            prev ? decimal(prev).plus(add).toFixed(2) : add,
          );
        }
        return budget.lines.map((line) => ({
          categoryId: line.categoryId,
          categoryName: line.category.name,
          limitAmount: line.limitAmount.toString(),
          spentAmount: spentMap.get(line.categoryId) ?? "0",
        }));
      })()
    : [];

  const budgetSummary = summarizeBudgetMonth(budgetLines);

  const patrimony = calculatePatrimonyNet({
    accounts: accountSnapshots,
    movements: rawMovements,
    investmentPositions: positions.map((p) => ({
      quantity: p.quantity.toString(),
      manualPrice: p.manualPrice.toString(),
      valuationMode: p.valuationMode,
      linkedAccountId: p.linkedAccountId,
    })),
    manualLiabilities: liabilities.map((l) => ({
      outstandingBalance: l.outstandingBalance.toString(),
    })),
  });

  const liabilitiesTotal = liabilities.reduce(
    (sum, l) => sum.plus(l.outstandingBalance.toString()),
    decimal(0),
  );

  const accountRows = accounts
    .map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      institution: account.institution,
      balance: calculateAccountBalance(
        account.openingBalance.toString(),
        rawMovements,
        account.id,
      ).toFixed(2),
    }))
    .sort((a, b) => decimal(b.balance).minus(decimal(a.balance)).toNumber())
    .slice(0, 4);

  const budgetCategories = budgetLines
    .map((line) => {
      const limit = decimal(line.limitAmount);
      const spent = decimal(line.spentAmount);
      const percent =
        limit.isZero() ? 0 : spent.div(limit).times(100).toDecimalPlaces(0).toNumber();
      return {
        name: line.categoryName,
        spent: line.spentAmount,
        limit: line.limitAmount,
        percent,
      };
    })
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);

  const budgetUtilization =
    decimal(budgetSummary.totalLimit).isZero()
      ? null
      : decimal(budgetSummary.totalSpent)
          .div(budgetSummary.totalLimit)
          .times(100)
          .toDecimalPlaces(0)
          .toNumber();

  const balanceSeries = buildBalanceSeries(accounts, transactions, 6);
  const incomeByCategory = buildIncomeCategoryBreakdown(monthTx);

  const treasuryBars =
    treasuryHorizons?.map((row) => ({
      label: row.horizonDays === 7 ? "+7d" : `+${row.horizonDays}d`,
      projectedBalance: Number(row.projectedBalance),
    })) ?? [];

  return {
    kpis: {
      totalBalance: totalBalance.toFixed(2),
      availableBalance: availableBalance.toFixed(2),
      savingsBalance: savingsBalance.toFixed(2),
      incomeMonth: calculateIncome(monthMovements).toFixed(2),
      expectedIncome: calculateExpectedIncome(rawMovements)
        .plus(expectedFromOccurrences)
        .toFixed(2),
      expenseMonth: calculateExpenses(monthMovements).toFixed(2),
      economicResultMonth: calculateCashFlow(monthMovements).toFixed(2),
      netCashMovementMonth: calculateNetCashMovement(monthMovements).toFixed(2),
      recurringDue30Total: recurringDue30
        .reduce((s, o) => s.plus(o.expectedAmount.toString()), decimal(0))
        .toFixed(2),
      recurringExpectedMonth: recurringExpectedMonthRows
        .filter((o) =>
          isInstantInCivilMonth(o.dueDate, year, month) &&
          (o.status === "EXPECTED" || o.status === "POSTPONED"),
        )
        .reduce((s, o) => s.plus(o.expectedAmount.toString()), decimal(0))
        .toFixed(2),
      recurringOverdueCount: recurringExpectedMonthRows.filter(
        (o) =>
          (o.status === "EXPECTED" || o.status === "POSTPONED") &&
          o.dueDate < new Date(),
      ).length,
      netWorth: calculateNetWorth(accountSnapshots, rawMovements).toFixed(2),
      netPatrimony: patrimony.netPatrimony,
      investmentsValue: patrimony.investmentsValue,
      liabilitiesTotal: liabilitiesTotal.toFixed(2),
      budgetLimitMonth: budgetSummary.totalLimit,
      budgetSpentMonth: budgetSummary.totalSpent,
      budgetAvailableMonth: budgetSummary.totalAvailable,
      savingsContribution: "0.00",
    },
    previous: {
      incomeMonth: calculateIncome(prevMovements).toFixed(2),
      expenseMonth: calculateExpenses(prevMovements).toFixed(2),
      economicResultMonth: calculateCashFlow(prevMovements).toFixed(2),
    },
    monthlyBuckets: buildMonthlySeries(transactions, 6),
    expenseByCategory: buildCategoryBreakdown(monthTx),
    widgets: {
      topAccounts: accountRows,
      budgetUtilization,
      budgetCategories,
      budgetSummary,
      treasuryBars,
      realBalance: totalBalance.toFixed(2),
      upcomingRecurring: upcomingRecurring.map((row) => ({
        name: row.recurringExpense.name,
        dueDate: row.dueDate.toISOString(),
        amount: row.expectedAmount.toString(),
        status: row.status,
      })),
      balanceSeries,
      incomeByCategory,
      patrimony: {
        accountsEngine: patrimony.accountNetWorth,
        investments: patrimony.investmentsValue,
        liabilities: liabilitiesTotal.toFixed(2),
        netPatrimony: patrimony.netPatrimony,
      },
    },
  };
}

function buildMonthlySeries(
  transactions: {
    occurredAt: Date;
    type: string;
    status: string;
    amount: { toString(): string };
    accountId: string;
    deletedAt: Date | null;
  }[],
  months: number,
) {
  const now = civilDateFromInstant(new Date());
  const buckets: { label: string; income: number; expense: number }[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    let month = now.month - offset;
    let year = now.year;
    while (month < 1) {
      month += 12;
      year -= 1;
    }

    const label = `${String(month).padStart(2, "0")}/${year}`;
    const slice = transactions
      .filter((tx) => isInstantInCivilMonth(tx.occurredAt, year, month))
      .map((tx) =>
        txToMovement({
          accountId: tx.accountId,
          type: tx.type as LedgerMovement["type"],
          status: tx.status as LedgerMovement["status"],
          amount: tx.amount,
          deletedAt: tx.deletedAt,
        }),
      );

    buckets.push({
      label,
      income: Number(calculateIncome(slice).toFixed(2)),
      expense: Number(calculateExpenses(slice).toFixed(2)),
    });
  }

  return buckets;
}

function buildCategoryBreakdown(
  transactions: {
    type: string;
    amount: { toString(): string };
    category: { name: string } | null;
  }[],
) {
  const map = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.type !== "EXPENSE") continue;
    const name = tx.category?.name ?? "Outros";
    const prev = map.get(name) ?? 0;
    map.set(name, prev + Math.abs(Number(tx.amount.toString())));
  }

  return [...map.entries()].map(([name, value]) => ({ name, value }));
}
