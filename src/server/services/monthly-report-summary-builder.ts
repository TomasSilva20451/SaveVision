import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  civilDateFromInstant,
  formatCivilDateIso,
  isInstantInCivilMonth,
} from "@/lib/datetime/civil-date";
import { calculateExpenses, calculateIncome, calculateCashFlow } from "@/lib/finance/aggregates";
import { detectFirstHighExpenseAnomaly } from "@/lib/finance/expense-anomaly-detection";
import {
  computeSavingsRate,
  monthlyReportFactsSchema,
  type MonthlyReportFacts,
} from "@/lib/finance/monthly-report-summary";
import { monthReportPeriod } from "@/lib/finance/report-period";
import { decimal } from "@/lib/finance/money";
import { safePercentChange } from "@/lib/finance/kpi";
import type { LedgerMovement } from "@/lib/finance/types";
import { db } from "@/lib/db";
import { getBudgetOverview } from "@/server/services/budgets";
import { loadReportData } from "@/server/services/reports";

function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

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

export async function buildMonthlyReportFacts(
  userId: string,
  workspaceId: string,
  year: number,
  month: number,
): Promise<MonthlyReportFacts | null> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const period = monthReportPeriod(year, month);
  const from = formatCivilDateIso(period.from);
  const to = formatCivilDateIso(period.to);
  const report = await loadReportData(userId, workspaceId, { from, to });
  if (!report) return null;

  const transactions = await db.transaction.findMany({
    where: { workspaceId, deletedAt: null, status: "COMPLETED" },
    include: { category: true },
  });

  const timed = transactions.map((tx) => ({ ...toMovement(tx), occurredAt: tx.occurredAt }));

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const current = {
    income: report.totals.income,
    expenses: report.totals.expenses,
    net: report.totals.cashFlow,
  };

  const prevSlice = timed.filter((tx) => isInstantInCivilMonth(tx.occurredAt, prevYear, prevMonth));
  const prevIncome = calculateIncome(prevSlice).toFixed(2);
  const prevExpenses = calculateExpenses(prevSlice).toFixed(2);
  const prevNet = calculateCashFlow(prevSlice).toFixed(2);

  const expenseTx = transactions.filter(
    (tx) =>
      tx.type === "EXPENSE" &&
      isInstantInCivilMonth(tx.occurredAt, year, month),
  );
  const byCategory = new Map<string, { name: string; amount: string }>();
  for (const tx of expenseTx) {
    const id = tx.categoryId ?? "none";
    const name = tx.category?.name ?? "Sem categoria";
    const add = decimal(tx.amount.toString()).abs();
    const prev = byCategory.get(id);
    byCategory.set(id, {
      name,
      amount: prev ? decimal(prev.amount).plus(add).toFixed(2) : add.toFixed(2),
    });
  }

  const expenseTotal = decimal(current.expenses).abs();
  const topCategories = [...byCategory.values()]
    .sort((a, b) => decimal(b.amount).cmp(decimal(a.amount)))
    .slice(0, 5)
    .map((row) => ({
      name: row.name,
      amount: row.amount,
      sharePercent: expenseTotal.gt(0)
        ? decimal(row.amount).div(expenseTotal).times(100).toDecimalPlaces(2).toFixed(2)
        : "0.00",
    }));

  const monthsWithData = new Set<string>();
  for (const tx of timed) {
    if (tx.type === "TRANSFER") continue;
    const civil = civilDateFromInstant(tx.occurredAt);
    monthsWithData.add(periodKey(civil.year, civil.month));
  }

  const uncategorized = expenseTx.filter((tx) => !tx.categoryId).length;

  const budget = await getBudgetOverview(userId, workspaceId, year, month);
  let budgetExecution: MonthlyReportFacts["budgetExecution"] = null;
  if (budget?.lines.length) {
    const over = budget.lines.filter((line) => decimal(line.overage).gt(0));
    const top = budget.lines
      .slice()
      .sort((a, b) => (b.utilizationPercent ?? 0) - (a.utilizationPercent ?? 0))[0];
    budgetExecution = {
      hasBudget: true,
      linesOverLimit: over.length,
      topPressure: top
        ? {
            categoryName: top.categoryName,
            utilizationPercent: top.utilizationPercent,
          }
        : null,
    };
  } else {
    budgetExecution = { hasBudget: false, linesOverLimit: 0, topPressure: null };
  }

  const goals = await db.savingsGoal.findMany({
    where: { workspaceId, archived: false },
    include: { contributions: true },
  });
  const goalsHighlight =
    goals
      .map((goal) => {
        const target = decimal(goal.targetAmount.toString());
        const contributed = goal.contributions.reduce(
          (sum, c) => sum.plus(c.amount.toString()),
          decimal(0),
        );
        const progressPercent = target.gt(0)
          ? contributed.div(target).times(100).toDecimalPlaces(0).toNumber()
          : null;
        return { name: goal.title, progressPercent };
      })
      .sort((a, b) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0))[0] ?? null;

  const activeAlertsCount = await db.financialAlert.count({
    where: { workspaceId, status: "ACTIVE" },
  });

  const atypicalFromRules = expenseTx
    .map((tx) => {
      if (!tx.categoryId) return null;
      const prior = expenseTx.filter(
        (other) =>
          other.categoryId === tx.categoryId &&
          other.occurredAt < tx.occurredAt &&
          other.id !== tx.id,
      ).length;
      return detectFirstHighExpenseAnomaly({
        transactionId: tx.id,
        categoryName: tx.category?.name ?? "Sem categoria",
        amount: tx.amount.toString(),
        priorCountInCategory: prior,
      });
    })
    .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    .slice(0, 3);

  const atypicalExpenses = atypicalFromRules.map((hit) => {
    const amountMatch = hit.evidence.find((line) => line.includes("Montante"));
    const amount = amountMatch?.match(/[\d.,]+/)?.[0]?.replace(",", ".") ?? "0.00";
    return {
      description: hit.description.slice(0, 120),
      amount,
      categoryName: hit.title.replace(/^Primeira despesa elevada: /, "") || null,
    };
  });

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  const upcomingOccurrences = await db.recurringExpenseOccurrence.findMany({
    where: {
      workspaceId,
      status: "EXPECTED",
      dueDate: { gte: new Date(), lte: horizon },
    },
    include: { recurringExpense: true },
    orderBy: { dueDate: "asc" },
    take: 5,
  });
  const upcomingCommitments = upcomingOccurrences.map((occ) => ({
    label: occ.recurringExpense.name,
    dueDate: formatCivilDateIso(civilDateFromInstant(occ.dueDate)),
    amount: decimal(occ.expectedAmount.toString()).abs().toFixed(2),
  }));

  const limitations: string[] = [];
  if (report.movementCount === 0) {
    limitations.push("O período não contém movimentos concluídos.");
  }
  if (!budget?.lines.length) {
    limitations.push("Não existem limites orçamentais definidos para este mês.");
  }

  const facts: MonthlyReportFacts = {
    period: periodKey(year, month),
    periodLabel: report.periodLabel,
    income: current.income,
    expenses: decimal(current.expenses).abs().toFixed(2),
    net: current.net,
    savingsRate: computeSavingsRate(current.income, current.net),
    previousMonth: {
      income: prevIncome,
      expenses: decimal(prevExpenses).abs().toFixed(2),
      net: prevNet,
      incomeChangePercent: safePercentChange(current.income, prevIncome),
      expensesChangePercent: safePercentChange(
        decimal(current.expenses).abs().toFixed(2),
        decimal(prevExpenses).abs().toFixed(2),
      ),
    },
    topCategories,
    budgetExecution,
    goalsHighlight,
    activeAlertsCount,
    atypicalExpenses,
    upcomingCommitments,
    dataQuality: {
      monthsAvailable: monthsWithData.size,
      missingCategories: uncategorized,
      movementCount: report.movementCount,
    },
    limitations,
  };

  return monthlyReportFactsSchema.parse(facts);
}
