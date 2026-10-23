import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import {
  civilDateFromInstant,
  isInstantInCivilMonth,
} from "@/lib/datetime/civil-date";
import {
  calculateAccountBalance,
  calculateCashFlow,
  calculateExpenses,
  calculateIncome,
} from "@/lib/finance/aggregates";
import { suggestCashSweep } from "@/lib/finance/cash-sweep";
import {
  buildGoalScenarios,
  monthlyContributionRequired,
} from "@/lib/finance/goal-projection";
import {
  emergencyFundTargetAmount,
  goalProgressPercent,
  sumContributions,
} from "@/lib/finance/goal-progress";
import { calculateFinancialHealthScore } from "@/lib/finance/health-score";
import { decimal } from "@/lib/finance/money";
import { db } from "@/lib/db";
import { appendAuditEvent } from "@/server/audit/audit-ledger";
import { listWorkspaceMovements } from "@/server/repositories/ledger";
import { getDashboardMetrics } from "@/server/services/dashboard";

export async function getPlanningOverview(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const [storedSettings, goals, cgdProducts, dashboard] = await Promise.all([
    db.workspacePlanningSettings.findUnique({ where: { workspaceId } }),
    db.savingsGoal.findMany({
      where: { workspaceId, archived: false },
      include: {
        contributions: { orderBy: { contributedAt: "desc" } },
        account: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.cgdProductRegistry.findMany({
      where: { workspaceId },
      orderBy: { label: "asc" },
    }),
    getDashboardMetrics(userId, workspaceId),
  ]);

  if (!dashboard) return null;

  const settings = storedSettings ?? {
    workspaceId,
    emergencyFundTargetMonths: 6,
    monthlyEssentialExpenses: null,
    updatedAt: new Date(0),
  };

  const today = civilDateFromInstant(new Date());

  const goalsWithProgress = goals.map((goal) => {
    const contributed = sumContributions(
      goal.contributions.map((c) => c.amount.toString()),
    ).toString();
    const target = goal.targetAmount.toString();
    let monthsRemaining = 24;
    if (goal.targetDate) {
      const end = civilDateFromInstant(goal.targetDate);
      monthsRemaining = Math.max(
        1,
        (end.year - today.year) * 12 + (end.month - today.month),
      );
    }
    const monthlyRequired = monthlyContributionRequired(
      target,
      contributed,
      monthsRemaining,
    );
    const scenarios = buildGoalScenarios({
      targetAmount: target,
      currentAmount: contributed,
      monthsRemaining,
      baseMonthlyContribution: monthlyRequired ?? "0",
      conservativeFactor: "0.85",
      optimisticFactor: "1.15",
    });
    return {
      ...goal,
      contributedTotal: contributed,
      progressPercent: goalProgressPercent(contributed, target),
      monthsRemaining,
      monthlyRequired,
      scenarios,
    };
  });

  const progressValues = goalsWithProgress
    .map((g) => g.progressPercent)
    .filter((p): p is number => p != null);
  const goalProgressAverage =
    progressValues.length > 0
      ? progressValues.reduce((a, b) => a + b, 0) / progressValues.length
      : null;

  const monthlyEssential =
    settings.monthlyEssentialExpenses?.toString() ??
    dashboard.kpis.expenseMonth;
  const emergencyTarget = emergencyFundTargetAmount(
    monthlyEssential,
    settings.emergencyFundTargetMonths,
  );

  const health = calculateFinancialHealthScore({
    savingsBalance: dashboard.kpis.savingsBalance,
    monthlyExpenses: monthlyEssential,
    emergencyTargetMonths: settings.emergencyFundTargetMonths,
    monthlyIncome: dashboard.kpis.incomeMonth,
    monthlyCashFlow: dashboard.kpis.economicResultMonth,
    goalProgressAverage,
  });

  const movements = await listWorkspaceMovements(workspaceId);
  const currentAccounts = await db.financialAccount.findMany({
    where: { workspaceId, type: "CURRENT", isArchived: false },
  });
  const currentBalance = currentAccounts
    .map((account) =>
      calculateAccountBalance(
        account.openingBalance.toString(),
        movements,
        account.id,
      ),
    )
    .reduce((sum, v) => sum.plus(v), decimal(0));

  const largestGap = goalsWithProgress.reduce((max, goal) => {
    const gap = decimal(goal.targetAmount.toString()).minus(goal.contributedTotal);
    return gap.gt(max) ? gap : max;
  }, decimal(0));

  const cashSweep = suggestCashSweep({
    currentAccountBalance: currentBalance.toFixed(2),
    minimumBuffer: monthlyEssential,
    savingsGoalGap: largestGap.gt(0) ? largestGap.toFixed(2) : "0",
  });

  return {
    settings,
    goals: goalsWithProgress,
    cgdProducts,
    health,
    emergencyTarget,
    monthlyEssential,
    cashSweep,
    dashboardKpis: dashboard.kpis,
  };
}

export async function createSavingsGoal(
  userId: string,
  workspaceId: string,
  input: {
    title: string;
    targetAmount: string;
    kind: "GENERAL" | "EMERGENCY_FUND";
    targetDate?: Date;
    accountId?: string;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const goal = await db.savingsGoal.create({
    data: {
      workspaceId,
      userId,
      title: input.title,
      kind: input.kind,
      targetAmount: decimal(input.targetAmount).toString(),
      targetDate: input.targetDate,
      accountId: input.accountId,
    },
  });
  await appendAuditEvent({ actorUserId: userId, workspaceId, action: "SAVINGS_GOAL_CREATED", resourceType: "SavingsGoal", resourceId: goal.id, outcome: "SUCCESS", source: "financial-service" });
  return goal;
}

export async function addGoalContribution(
  userId: string,
  workspaceId: string,
  input: { goalId: string; amount: string; contributedAt: Date; notes?: string },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const goal = await db.savingsGoal.findFirst({
    where: { id: input.goalId, workspaceId, archived: false },
  });
  if (!goal) return null;

  const contribution = await db.savingsGoalContribution.create({
    data: {
      workspaceId,
      goalId: goal.id,
      userId,
      amount: decimal(input.amount).toString(),
      contributedAt: input.contributedAt,
      notes: input.notes,
    },
  });
  await appendAuditEvent({ actorUserId: userId, workspaceId, action: "SAVINGS_CONTRIBUTION_CREATED", resourceType: "SavingsGoalContribution", resourceId: contribution.id, outcome: "SUCCESS", source: "financial-service", metadata: { goalId: goal.id } });
  return contribution;
}

export async function updatePlanningSettings(
  userId: string,
  workspaceId: string,
  input: {
    emergencyFundTargetMonths: number;
    monthlyEssentialExpenses?: string;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const monthlyEssentialExpenses = input.monthlyEssentialExpenses
    ? decimal(input.monthlyEssentialExpenses).toString()
    : undefined;

  const settings = await db.workspacePlanningSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      emergencyFundTargetMonths: input.emergencyFundTargetMonths,
      monthlyEssentialExpenses,
    },
    update: {
      emergencyFundTargetMonths: input.emergencyFundTargetMonths,
      monthlyEssentialExpenses,
    },
  });
  await appendAuditEvent({ actorUserId: userId, workspaceId, action: "PLANNING_SETTINGS_CHANGED", resourceType: "WorkspacePlanningSettings", resourceId: workspaceId, outcome: "SUCCESS", source: "financial-service" });
  return settings;
}

export async function registerCgdProduct(
  userId: string,
  workspaceId: string,
  input: {
    label: string;
    category: "DEPOSIT" | "SAVINGS" | "INVESTMENT" | "OTHER";
    reference?: string;
    notes?: string;
  },
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const product = await db.cgdProductRegistry.create({
    data: {
      workspaceId,
      userId,
      label: input.label,
      category: input.category,
      reference: input.reference,
      notes: input.notes,
    },
  });
  await appendAuditEvent({ actorUserId: userId, workspaceId, action: "FINANCIAL_PRODUCT_REGISTERED", resourceType: "CgdProductRegistry", resourceId: product.id, outcome: "SUCCESS", source: "financial-service" });
  return product;
}

export async function listSavingsGoalSummaries(userId: string, workspaceId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const goals = await db.savingsGoal.findMany({
    where: { workspaceId, archived: false },
    include: { contributions: true },
    orderBy: { createdAt: "asc" },
    take: 4,
  });

  return goals.map((goal) => {
    const contributed = sumContributions(goal.contributions.map((row) => row.amount.toString())).toFixed(2);
    return {
      id: goal.id,
      title: goal.title,
      targetAmount: goal.targetAmount.toString(),
      contributed,
      progressPercent: goalProgressPercent(contributed, goal.targetAmount.toString()),
    };
  });
}

export async function monthlyTotalsForForecast(
  userId: string,
  workspaceId: string,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const civil = civilDateFromInstant(new Date());
  const transactions = await db.transaction.findMany({
    where: { workspaceId, deletedAt: null },
  });

  const monthSlice = transactions.filter((tx) =>
    isInstantInCivilMonth(tx.occurredAt, civil.year, civil.month),
  );
  const sliceMovements = monthSlice.map((tx) => ({
    accountId: tx.accountId,
    type: tx.type as "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT",
    status: tx.status as "PENDING" | "EXPECTED" | "COMPLETED" | "CANCELLED",
    amount: tx.amount.toString(),
    deletedAt: tx.deletedAt,
  }));

  return {
    income: calculateIncome(sliceMovements).toFixed(2),
    expenses: calculateExpenses(sliceMovements).toFixed(2),
    cashFlow: calculateCashFlow(sliceMovements).toFixed(2),
  };
}
