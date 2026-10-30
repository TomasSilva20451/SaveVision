import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  civilDateFromInstant,
  isInstantInCivilMonth,
  startOfCivilDay,
} from "@/lib/datetime/civil-date";
import {
  ALERT_TREASURY_HORIZON_DAYS,
  compareAlertsByRelevance,
  evaluateFinancialAlertCandidates,
  isOccurrenceDueSoon,
  isOccurrenceOverdue,
  type AlertCandidate,
  type AlertSeverity,
  type FinancialAlertsEvaluationInput,
} from "@/lib/finance/financial-alerts";
import type { BudgetLineSnapshot } from "@/lib/finance/budget";
import { buildFinancialInsights, pickTopInsights } from "@/lib/finance/financial-insights";
import { decimal } from "@/lib/finance/money";
import { buildTreasuryProjection } from "@/lib/finance/treasury-forecast";
import { describeRecurringLiabilityMismatch } from "@/lib/finance/liability-recurring-link";
import { db } from "@/lib/db";
import { loadTreasuryContext } from "@/server/services/treasury-forecast";
import { getPlanningOverview } from "@/server/services/planning";
import { evaluateSavingsPlanAlertCandidates } from "@/lib/finance/savings-plan-alerts";
import { loadSavingsPlanAlertContext } from "@/server/services/savings-plan";
import type {
  FinancialAlertSeverity,
  FinancialAlertStatus,
  FinancialAlertType,
  Prisma,
} from "@/generated/prisma/client";

const MANAGED_ALERT_TYPES: FinancialAlertType[] = [
  "LOW_PROJECTED_BALANCE",
  "NEGATIVE_PROJECTED_BALANCE",
  "BUDGET_NEAR_LIMIT",
  "BUDGET_EXCEEDED",
  "RECURRING_EXPENSE_DUE",
  "RECURRING_EXPENSE_OVERDUE",
  "EXPECTED_INCOME_OVERDUE",
  "UNUSUAL_EXPENSE",
  "EMERGENCY_FUND_BELOW_TARGET",
  "RECURRING_LIABILITY_CONFIGURATION",
  "DUPLICATE_PAYMENT_RISK",
  "SAVINGS_PLAN_CONTRIBUTION_DUE",
  "SAVINGS_PLAN_CONTRIBUTION_MISSED",
  "SAVINGS_PLAN_ACCOUNT_WITHDRAWAL",
  "SAVINGS_PLAN_COMPLETED",
];

function toPrismaSeverity(severity: AlertSeverity): FinancialAlertSeverity {
  return severity;
}

function mapCandidateToCreate(
  workspaceId: string,
  candidate: AlertCandidate,
  now: Date,
): Prisma.FinancialAlertCreateInput {
  return {
    workspace: { connect: { id: workspaceId } },
    type: candidate.type as FinancialAlertType,
    severity: toPrismaSeverity(candidate.severity),
    title: candidate.title,
    description: candidate.description,
    status: "ACTIVE",
    deduplicationKey: candidate.deduplicationKey,
    sourceType: candidate.sourceType ?? null,
    sourceId: candidate.sourceId ?? null,
    periodStart: candidate.periodStart ?? null,
    periodEnd: candidate.periodEnd ?? null,
    evidence: (candidate.evidence ?? undefined) as Prisma.InputJsonValue | undefined,
    actionUrl: candidate.actionUrl ?? null,
    detectedAt: now,
    lastEvaluatedAt: now,
    resolvedAt: null,
  };
}

export async function buildFinancialAlertsEvaluationInput(
  userId: string,
  workspaceId: string,
): Promise<FinancialAlertsEvaluationInput | null> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const asOf = new Date();
  const civil = civilDateFromInstant(asOf);
  const year = civil.year;
  const month = civil.month;

  const context = await loadTreasuryContext(userId, workspaceId);
  if (!context) return null;

  const projection30 = buildTreasuryProjection({
    startingBalance: context.startingBalance,
    events: context.eventsMaxHorizon,
    horizonDays: ALERT_TREASURY_HORIZON_DAYS,
    asOf: context.asOf,
  });

  const [budgetRow, recurringOccurrences, incomeOverdue, recurringActive, liabilities, planning] =
    await Promise.all([
      db.monthlyBudget.findUnique({
        where: { workspaceId_year_month: { workspaceId, year, month } },
        include: { lines: { include: { category: true } } },
      }),
      db.recurringExpenseOccurrence.findMany({
        where: {
          workspaceId,
          status: { in: ["EXPECTED", "POSTPONED"] },
        },
        include: { recurringExpense: true },
      }),
      db.incomeOccurrence.findMany({
        where: {
          workspaceId,
          status: "EXPECTED",
          scheduledFor: { lt: startOfCivilDay(civilDateFromInstant(asOf)) },
        },
      }),
      db.recurringExpense.findMany({
        where: { workspaceId, status: "ACTIVE", linkedLiabilityId: { not: null } },
        include: { linkedLiability: true },
      }),
      db.financialLiability.findMany({ where: { workspaceId } }),
      getPlanningOverview(userId, workspaceId),
    ]);

  const spentMap = new Map<string, string>();
  const transactions = await db.transaction.findMany({
    where: { workspaceId, deletedAt: null, type: "EXPENSE", status: "COMPLETED" },
    include: { category: true },
  });
  for (const tx of transactions) {
    if (!isInstantInCivilMonth(tx.occurredAt, year, month)) continue;
    const cid = tx.categoryId ?? "uncategorized";
    const prev = spentMap.get(cid) ?? "0";
    spentMap.set(cid, decimal(prev).plus(decimal(tx.amount.toString()).abs()).toFixed(2));
  }

  const budgetLines: BudgetLineSnapshot[] =
    budgetRow?.lines.map((line) => ({
      categoryId: line.categoryId,
      categoryName: line.category.name,
      limitAmount: line.limitAmount.toString(),
      spentAmount: spentMap.get(line.categoryId) ?? "0",
    })) ?? [];

  const recurringOverdue = recurringOccurrences
    .filter((o) => isOccurrenceOverdue(o.dueDate, asOf))
    .map((o) => ({
      occurrenceId: o.id,
      recurringId: o.recurringExpenseId,
      name: o.recurringExpense.name,
      dueDate: o.dueDate,
      status: o.status as "EXPECTED" | "POSTPONED",
      expectedAmount: o.expectedAmount.toString(),
    }));

  const recurringDueSoon = recurringOccurrences
    .filter(
      (o) =>
        !isOccurrenceOverdue(o.dueDate, asOf) &&
        isOccurrenceDueSoon(o.dueDate, asOf),
    )
    .map((o) => ({
      occurrenceId: o.id,
      recurringId: o.recurringExpenseId,
      name: o.recurringExpense.name,
      dueDate: o.dueDate,
      status: o.status as "EXPECTED" | "POSTPONED",
      expectedAmount: o.expectedAmount.toString(),
    }));

  const configurationWarnings: { recurringId?: string; message: string }[] = [];
  const allRecurring = await db.recurringExpense.findMany({
    where: { workspaceId },
    include: { linkedLiability: true },
  });
  for (const row of allRecurring) {
    if (!row.linkedLiabilityId || !row.linkedLiability) continue;
    const msg = describeRecurringLiabilityMismatch({
      recurringStatus: row.status,
      recurringFrequency: row.frequency,
      recurringAmount: row.expectedAmount.toString(),
      linkedLiabilityId: row.linkedLiabilityId,
      liabilityMonthlyPayment: row.linkedLiability.monthlyPayment?.toString() ?? null,
      liabilityOutstanding: row.linkedLiability.outstandingBalance.toString(),
    });
    if (msg) {
      configurationWarnings.push({ recurringId: row.id, message: `${row.name}: ${msg}` });
    }
  }
  for (const liability of liabilities) {
    if (!liability.monthlyPayment) continue;
    const covered = allRecurring.some(
      (r) => r.linkedLiabilityId === liability.id && r.status === "ACTIVE",
    );
    if (!covered && !liability.paymentDueDayOfMonth) {
      configurationWarnings.push({
        message: `${liability.title}: defina o dia de vencimento ou associe uma recorrência.`,
      });
    }
  }

  const linkedRecurringRisks = recurringActive
    .filter((r) => r.linkedLiability)
    .map((r) => ({
      recurringId: r.id,
      recurringName: r.name,
      liabilityId: r.linkedLiabilityId!,
      liabilityTitle: r.linkedLiability!.title,
    }));

  const expenseMovements = transactions
    .filter((tx) => tx.type === "EXPENSE" && tx.status === "COMPLETED")
    .map((tx) => ({
      occurredAt: tx.occurredAt,
      amount: tx.amount.toString(),
      categoryId: tx.categoryId ?? "uncategorized",
      categoryName: tx.category?.name ?? "Sem categoria",
    }));

  const incomeMonth = transactions
    .filter(
      (t) =>
        t.type === "INCOME" &&
        t.status === "COMPLETED" &&
        isInstantInCivilMonth(t.occurredAt, year, month),
    )
    .reduce((s, t) => s.plus(decimal(t.amount.toString())), decimal(0))
    .toFixed(2);

  const expenseMonth = transactions
    .filter(
      (t) =>
        t.type === "EXPENSE" &&
        t.status === "COMPLETED" &&
        isInstantInCivilMonth(t.occurredAt, year, month),
    )
    .reduce((s, t) => s.plus(decimal(t.amount.toString()).abs()), decimal(0))
    .toFixed(2);

  const insightsResult = buildFinancialInsights({
    workspaceId,
    civilYear: year,
    civilMonth: month,
    expenseMovements,
    incomeMonth,
    incomePreviousMonth: "0",
    expenseMonth,
    expensePreviousMonth: "0",
    economicResultMonth: "0",
    budgetLines,
    subscriptions: allRecurring.map((r) => ({
      id: r.id,
      name: r.name,
      expectedAmount: r.expectedAmount.toString(),
      frequency: r.frequency,
      status: r.status,
    })),
    upcomingWeekOutflows: "0",
    savingsRateCurrent: null,
    savingsRatePrevious: null,
  });

  const anomalyInsights = pickTopInsights(insightsResult.insights, 20).filter(
    (i) => i.type === "ANOMALY",
  );

  let emergencyFundCurrent: string | null = null;
  let emergencyFundTarget: string | null = null;
  if (planning) {
    emergencyFundTarget = planning.emergencyTarget;
    emergencyFundCurrent = planning.dashboardKpis.savingsBalance;
  } else {
    emergencyFundTarget = null;
    emergencyFundCurrent = null;
  }

  return {
    workspaceId,
    civilYear: year,
    civilMonth: month,
    treasuryTimeline30: projection30.timeline,
    realBalance: context.startingBalance,
    budgetLines,
    recurringDueSoon,
    recurringOverdue,
    overdueIncome: incomeOverdue.map((row) => ({
      occurrenceId: row.id,
      label: row.title,
      scheduledFor: row.scheduledFor,
      expectedAmount: row.expectedAmount.toString(),
    })),
    emergencyFundCurrent,
    emergencyFundTarget,
    configurationWarnings,
    linkedRecurringRisks,
    anomalyInsights,
    asOf,
  };
}

export async function syncFinancialAlerts(userId: string, workspaceId: string): Promise<number> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return 0;

  const input = await buildFinancialAlertsEvaluationInput(userId, workspaceId);
  if (!input) return 0;

  let candidates = evaluateFinancialAlertCandidates(input);
  const savingsCtx = await loadSavingsPlanAlertContext(workspaceId, input.asOf);
  if (savingsCtx) {
    const ruleCategoryIds = new Set(
      savingsCtx.plans.flatMap((p) => p.budgetRules.map((r) => r.categoryId)),
    );
    const planBudgetLines = new Map<string, BudgetLineSnapshot>();
    for (const line of input.budgetLines) {
      if (ruleCategoryIds.has(line.categoryId)) {
        planBudgetLines.set(line.categoryId, line);
      }
    }
    candidates = [
      ...candidates,
      ...evaluateSavingsPlanAlertCandidates({
        workspaceId,
        asOf: input.asOf,
        plans: savingsCtx.plans,
        checkIns: savingsCtx.checkIns,
        budgetLinesByCategory: planBudgetLines,
        withdrawals: savingsCtx.withdrawals,
        civilYear: savingsCtx.civilYear,
        civilMonth: savingsCtx.civilMonth,
      }),
    ];
  }
  const now = new Date();
  const activeKeys = new Set(candidates.map((c) => c.deduplicationKey));

  await db.$transaction(async (tx) => {
    for (const candidate of candidates) {
      await tx.financialAlert.upsert({
        where: {
          workspaceId_deduplicationKey: {
            workspaceId,
            deduplicationKey: candidate.deduplicationKey,
          },
        },
        create: mapCandidateToCreate(workspaceId, candidate, now),
        update: {
          type: candidate.type as FinancialAlertType,
          severity: toPrismaSeverity(candidate.severity),
          title: candidate.title,
          description: candidate.description,
          status: "ACTIVE",
          sourceType: candidate.sourceType ?? null,
          sourceId: candidate.sourceId ?? null,
          periodStart: candidate.periodStart ?? null,
          periodEnd: candidate.periodEnd ?? null,
          evidence: (candidate.evidence ?? undefined) as Prisma.InputJsonValue | undefined,
          actionUrl: candidate.actionUrl ?? null,
          lastEvaluatedAt: now,
          resolvedAt: null,
        },
      });
    }

    const stale = await tx.financialAlert.findMany({
      where: {
        workspaceId,
        status: "ACTIVE",
        type: { in: MANAGED_ALERT_TYPES },
        deduplicationKey: { notIn: [...activeKeys] },
      },
      select: { id: true },
    });

    if (stale.length > 0) {
      await tx.financialAlert.updateMany({
        where: { id: { in: stale.map((s) => s.id) } },
        data: { status: "RESOLVED", resolvedAt: now, lastEvaluatedAt: now },
      });
    }
  });

  return candidates.length;
}

export type FinancialAlertView = {
  id: string;
  type: FinancialAlertType;
  severity: FinancialAlertSeverity;
  title: string;
  description: string;
  status: FinancialAlertStatus;
  actionUrl: string | null;
  evidence: unknown;
  sourceType: string | null;
  sourceId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  detectedAt: Date;
  resolvedAt: Date | null;
  seenAt: Date | null;
  dismissedAt: Date | null;
};

export async function listFinancialAlerts(
  userId: string,
  workspaceId: string,
  options?: {
    status?: FinancialAlertStatus;
    includeDismissed?: boolean;
  },
): Promise<FinancialAlertView[] | null> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const status = options?.status ?? "ACTIVE";
  const rows = await db.financialAlert.findMany({
    where: { workspaceId, status },
    orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
    include: {
      userStates: { where: { userId }, take: 1 },
    },
  });

  const mapped = rows
    .map((row) => {
      const state = row.userStates[0];
      return {
        id: row.id,
        type: row.type,
        severity: row.severity,
        title: row.title,
        description: row.description,
        status: row.status,
        actionUrl: row.actionUrl,
        evidence: row.evidence,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        detectedAt: row.detectedAt,
        resolvedAt: row.resolvedAt,
        seenAt: state?.seenAt ?? null,
        dismissedAt: state?.dismissedAt ?? null,
      };
    })
    .filter((row) => options?.includeDismissed || !row.dismissedAt);

  mapped.sort((a, b) =>
    compareAlertsByRelevance(
      { severity: a.severity as AlertSeverity, detectedAt: a.detectedAt },
      { severity: b.severity as AlertSeverity, detectedAt: b.detectedAt },
    ),
  );

  return mapped;
}

export async function countUnseenFinancialAlerts(
  userId: string,
  workspaceId: string,
): Promise<number> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return 0;

  const rows = await db.financialAlert.findMany({
    where: { workspaceId, status: "ACTIVE" },
    include: { userStates: { where: { userId }, take: 1 } },
  });

  return rows.filter((row) => {
    const state = row.userStates[0];
    return !state?.seenAt && !state?.dismissedAt;
  }).length;
}

async function upsertUserState(
  alertId: string,
  userId: string,
  patch: { seenAt?: Date; dismissedAt?: Date },
) {
  const existing = await db.financialAlertUserState.findUnique({
    where: { alertId_userId: { alertId, userId } },
  });
  if (existing) {
    await db.financialAlertUserState.update({
      where: { id: existing.id },
      data: patch,
    });
    return;
  }
  await db.financialAlertUserState.create({
    data: { alertId, userId, ...patch },
  });
}

export async function markFinancialAlertSeen(
  userId: string,
  workspaceId: string,
  alertId: string,
): Promise<boolean> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return false;

  const alert = await db.financialAlert.findFirst({
    where: { id: alertId, workspaceId },
  });
  if (!alert) return false;

  await upsertUserState(alertId, userId, { seenAt: new Date() });
  return true;
}

export async function dismissFinancialAlert(
  userId: string,
  workspaceId: string,
  alertId: string,
): Promise<boolean> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return false;

  const alert = await db.financialAlert.findFirst({
    where: { id: alertId, workspaceId },
  });
  if (!alert) return false;

  const now = new Date();
  await upsertUserState(alertId, userId, { seenAt: now, dismissedAt: now });
  return true;
}

export async function markAllFinancialAlertsSeen(
  userId: string,
  workspaceId: string,
): Promise<number> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return 0;

  const active = await db.financialAlert.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: { id: true },
  });

  const now = new Date();
  let count = 0;
  for (const row of active) {
    await upsertUserState(row.id, userId, { seenAt: now });
    count += 1;
  }
  return count;
}

export async function evaluateAndSyncFinancialAlerts(
  userId: string,
  workspaceId: string,
) {
  return syncFinancialAlerts(userId, workspaceId);
}
