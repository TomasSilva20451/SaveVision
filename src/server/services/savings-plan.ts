import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import {
  civilDateFromInstant,
  civilDateIsoToInstant,
  formatCivilDateIso,
  isInstantInCivilMonth,
  parseCivilDateIso,
  startOfCivilDay,
} from "@/lib/datetime/civil-date";
import { decimal } from "@/lib/finance/money";
import {
  buildWeeklyPeriods,
  civilMonthsThroughTarget,
  computePlanProgress,
  normalizeCategoryLabel,
  proportionalMonthLimit,
  weeksRemaining,
} from "@/lib/finance/savings-plan-engine";
import {
  getSavingsPlanTemplate,
  type SavingsPlanBudgetTemplateLine,
} from "@/lib/finance/savings-plan-template";
import { db } from "@/lib/db";
import type { CategoryBehavior, CategoryNature } from "@/generated/prisma/client";
import { appendAuditEvent } from "@/server/audit/audit-ledger";
import { writeFinancialAuditLog } from "@/server/audit/financial-audit";
import { createTransferInTransaction } from "@/server/services/transfers";
import type { Prisma } from "@/generated/prisma/client";

type DbOrTx = typeof db | Prisma.TransactionClient;
import {
  buildSavingsPlanReportSection,
  type SavingsPlanReportSection,
} from "@/lib/finance/savings-plan-report";
import {
  buildWeeklyReviewSnapshot,
  type WeeklyReviewSnapshot,
} from "@/lib/finance/savings-plan-weekly-review";
import type { BudgetLineSnapshot } from "@/lib/finance/budget";

export type SavingsPlanWizardInput = {
  templateKey?: string;
  name: string;
  targetAmount: string;
  targetDateIso: string;
  plannedWeeklyContribution: string;
  contributionWeekday: number;
  reviewWeekday: number;
  alertThresholdPercent: number;
  savingsAccountId?: string;
  sourceAccountId?: string;
  createSavingsAccountName?: string;
  budgetStartMode: "NEXT_MONTH" | "PROPORTIONAL_CURRENT";
  budgetLines: readonly {
    categoryName: string;
    monthlyLimit: string;
    nature: CategoryNature;
    behavior: CategoryBehavior;
  }[];
  confirmBudgetOverrides: boolean;
  idempotencyKey: string;
};

export type SavingsPlanPreviewEntity = {
  kind: "create" | "reuse" | "conflict";
  label: string;
  detail?: string;
};

export type SavingsPlanActivationPreview = {
  workspacePersonal: boolean;
  entities: SavingsPlanPreviewEntity[];
  budgetMonths: { year: number; month: number; lines: { categoryName: string; limit: string; conflict?: string }[] }[];
  alertSummary: string[];
  noTransactionsCreated: true;
  initialAccountBalance: "0.00";
};

function requirePersonalWorkspace(type: string): boolean {
  return type === "PERSONAL";
}

export async function buildSavingsPlanActivationPreview(
  userId: string,
  workspaceId: string,
  input: SavingsPlanWizardInput,
): Promise<SavingsPlanActivationPreview | null> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || !requirePersonalWorkspace(workspace.type)) return null;

  const entities: SavingsPlanPreviewEntity[] = [];
  const existingPlan = await db.savingsPlan.findUnique({
    where: {
      workspaceId_activationKey: {
        workspaceId,
        activationKey: input.idempotencyKey,
      },
    },
  });
  if (existingPlan) {
    entities.push({
      kind: "reuse",
      label: "Plano de poupança",
      detail: `Já activo (${existingPlan.name}) — a confirmação será idempotente.`,
    });
  } else {
    entities.push({ kind: "create", label: "Objetivo de poupança", detail: input.name });
    entities.push({ kind: "create", label: "Plano de poupança", detail: input.name });
    entities.push({ kind: "create", label: "Check-ins semanais", detail: "Um por semana até à data-alvo" });
  }

  if (input.sourceAccountId) {
    const source = await db.financialAccount.findFirst({
      where: { id: input.sourceAccountId, workspaceId, isArchived: false },
    });
    if (source) {
      entities.push({
        kind: "reuse",
        label: "Conta de origem (contribuições)",
        detail: source.name,
      });
    }
  }

  if (input.savingsAccountId) {
    const account = await db.financialAccount.findFirst({
      where: { id: input.savingsAccountId, workspaceId, isArchived: false },
    });
    if (account) {
      entities.push({ kind: "reuse", label: "Conta de poupança", detail: account.name });
    }
  } else if (input.createSavingsAccountName) {
    const dup = await db.financialAccount.findFirst({
      where: { workspaceId, name: input.createSavingsAccountName, isArchived: false },
    });
    entities.push({
      kind: dup ? "conflict" : "create",
      label: "Conta de poupança",
      detail: dup
        ? `Já existe "${dup.name}" — escolhe reutilizar ou outro nome.`
        : `${input.createSavingsAccountName} (saldo inicial 0 €)`,
    });
  }

  const categories = await db.category.findMany({ where: { workspaceId } });
  const byNorm = new Map(categories.map((c) => [normalizeCategoryLabel(c.name), c]));

  for (const line of input.budgetLines) {
    const hit = byNorm.get(normalizeCategoryLabel(line.categoryName));
    entities.push({
      kind: hit ? "reuse" : "create",
      label: `Categoria ${line.categoryName}`,
      detail: hit ? "Existente" : `${line.nature} / ${line.behavior}`,
    });
  }

  const today = civilDateFromInstant(new Date());
  let budgetFromYear = today.year;
  let budgetFromMonth = today.month;
  if (input.budgetStartMode === "NEXT_MONTH") {
    budgetFromMonth += 1;
    if (budgetFromMonth > 12) {
      budgetFromMonth = 1;
      budgetFromYear += 1;
    }
  }

  const months = civilMonthsThroughTarget(budgetFromYear, budgetFromMonth, input.targetDateIso);
  const budgetMonths: SavingsPlanActivationPreview["budgetMonths"] = [];

  for (const { year, month } of months) {
    const lines: SavingsPlanActivationPreview["budgetMonths"][number]["lines"] = [];
    for (const line of input.budgetLines) {
      let limit = line.monthlyLimit;
      if (input.budgetStartMode === "PROPORTIONAL_CURRENT" && year === today.year && month === today.month) {
        limit = proportionalMonthLimit(line.monthlyLimit, year, month, new Date());
      }
      const category = byNorm.get(normalizeCategoryLabel(line.categoryName));
      let conflict: string | undefined;
      if (category) {
        const budget = await db.monthlyBudget.findUnique({
          where: { workspaceId_year_month: { workspaceId, year, month } },
          include: { lines: { where: { categoryId: category.id } } },
        });
      if (budget && budget.lines.length > 0) {
        const existing = budget.lines[0]!;
        if (existing.limitAmount.toString() !== limit) {
          conflict = `Limite actual ${existing.limitAmount.toString()} €`;
        }
      }
      }
      lines.push({ categoryName: line.categoryName, limit, conflict });
    }
    budgetMonths.push({ year, month, lines });
  }

  const alertSummary = [
    `Orçamentos do plano: alerta aos ${input.alertThresholdPercent}% (não altera o limite global de 85%).`,
    "Contribuição semanal não confirmada até ao fim da semana.",
    "Saída de dinheiro da conta de poupança associada.",
    "Objetivo concluído quando as contribuições confirmadas atingirem o alvo.",
  ];

  return {
    workspacePersonal: true,
    entities,
    budgetMonths,
    alertSummary,
    noTransactionsCreated: true,
    initialAccountBalance: "0.00",
  };
}

export async function activateSavingsPlan(
  userId: string,
  workspaceId: string,
  input: SavingsPlanWizardInput,
): Promise<{ planId: string; reused: boolean } | null> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || !requirePersonalWorkspace(workspace.type)) return null;

  const existing = await db.savingsPlan.findUnique({
    where: {
      workspaceId_activationKey: { workspaceId, activationKey: input.idempotencyKey },
    },
  });
  if (existing) {
    return { planId: existing.id, reused: true };
  }

  const preview = await buildSavingsPlanActivationPreview(userId, workspaceId, input);
  if (!preview) return null;
  const hasUnresolvedConflict = preview.entities.some((e) => e.kind === "conflict");
  const budgetConflict = preview.budgetMonths.some((m) =>
    m.lines.some((l) => l.conflict && !input.confirmBudgetOverrides),
  );
  if (hasUnresolvedConflict || budgetConflict) return null;

  const targetDate = civilDateIsoToInstant(input.targetDateIso);
  const today = civilDateFromInstant(new Date());
  const periods = buildWeeklyPeriods(today, parseCivilDateIso(input.targetDateIso), input.contributionWeekday);

  const result = await db.$transaction(async (tx) => {
    let savingsAccountId = input.savingsAccountId;
    if (!savingsAccountId) {
      const name = input.createSavingsAccountName ?? "Poupança";
      const account = await tx.financialAccount.create({
        data: {
          workspaceId,
          ownerUserId: userId,
          name,
          type: "SAVINGS",
          openingBalance: "0",
        },
      });
      await writeFinancialAuditLog({
        workspaceId,
        actorUserId: userId,
        action: "ACCOUNT_CREATED",
        entityType: "FinancialAccount",
        entityId: account.id,
        metadata: { source: "savings-plan", name },
      });
      savingsAccountId = account.id;
    } else {
      const account = await tx.financialAccount.findFirst({
        where: { id: savingsAccountId, workspaceId, isArchived: false },
      });
      if (!account) throw new Error("Conta inválida");
    }

    let sourceAccountId: string | null = input.sourceAccountId ?? null;
    if (sourceAccountId) {
      const source = await tx.financialAccount.findFirst({
        where: {
          id: sourceAccountId,
          workspaceId,
          isArchived: false,
          type: { in: ["CURRENT", "CASH", "OTHER"] },
        },
      });
      if (!source || source.id === savingsAccountId) {
        throw new Error("Conta de origem inválida");
      }
    } else {
      sourceAccountId = await resolveSavingsPlanSourceAccountId(tx, workspaceId, {
        sourceAccountId: null,
        savingsAccountId: savingsAccountId!,
      });
    }

    const goal = await tx.savingsGoal.create({
      data: {
        workspaceId,
        userId,
        title: input.name,
        kind: "GENERAL",
        targetAmount: decimal(input.targetAmount).toString(),
        targetDate,
        accountId: savingsAccountId,
      },
    });

    const firstDue = periods[0]
      ? startOfCivilDay(parseCivilDateIso(formatCivilDateIso(periods[0].periodStart)))
      : null;

    const plan = await tx.savingsPlan.create({
      data: {
        workspaceId,
        userId,
        goalId: goal.id,
        savingsAccountId: savingsAccountId!,
        sourceAccountId,
        name: input.name,
        status: "ACTIVE",
        plannedContributionAmount: decimal(input.plannedWeeklyContribution).toString(),
        contributionWeekday: input.contributionWeekday,
        reviewWeekday: input.reviewWeekday,
        alertThresholdPercent: input.alertThresholdPercent,
        activatedAt: new Date(),
        nextContributionDueAt: firstDue,
        activationKey: input.idempotencyKey,
        investmentGuardEnabled: true,
      },
    });

    const categories = await tx.category.findMany({ where: { workspaceId } });
    const byNorm = new Map(categories.map((c) => [normalizeCategoryLabel(c.name), c]));

    for (const line of input.budgetLines) {
      let category = byNorm.get(normalizeCategoryLabel(line.categoryName));
      if (!category) {
        category = await tx.category.create({
          data: {
            workspaceId,
            name: line.categoryName,
            nature: line.nature,
            behavior: line.behavior,
          },
        });
        byNorm.set(normalizeCategoryLabel(category.name), category);
      }
      await tx.savingsPlanBudgetRule.create({
        data: {
          savingsPlanId: plan.id,
          categoryId: category.id,
          monthlyLimitAmount: decimal(line.monthlyLimit).toString(),
          alertThresholdPercent: input.alertThresholdPercent,
        },
      });
    }

    let budgetFromYear = today.year;
    let budgetFromMonth = today.month;
    if (input.budgetStartMode === "NEXT_MONTH") {
      budgetFromMonth += 1;
      if (budgetFromMonth > 12) {
        budgetFromMonth = 1;
        budgetFromYear += 1;
      }
    }
    const months = civilMonthsThroughTarget(budgetFromYear, budgetFromMonth, input.targetDateIso);
    for (const { year, month } of months) {
      const budget = await tx.monthlyBudget.upsert({
        where: { workspaceId_year_month: { workspaceId, year, month } },
        create: { workspaceId, year, month },
        update: {},
      });
      for (const line of input.budgetLines) {
        const category = byNorm.get(normalizeCategoryLabel(line.categoryName))!;
        let limit = line.monthlyLimit;
        if (input.budgetStartMode === "PROPORTIONAL_CURRENT" && year === today.year && month === today.month) {
          limit = proportionalMonthLimit(line.monthlyLimit, year, month, new Date());
        }
        await tx.budgetLine.upsert({
          where: {
            monthlyBudgetId_categoryId: {
              monthlyBudgetId: budget.id,
              categoryId: category.id,
            },
          },
          create: {
            monthlyBudgetId: budget.id,
            categoryId: category.id,
            limitAmount: limit,
          },
          update: input.confirmBudgetOverrides ? { limitAmount: limit } : {},
        });
      }
    }

    for (const period of periods) {
      await tx.savingsPlanCheckIn.create({
        data: {
          workspaceId,
          savingsPlanId: plan.id,
          periodStart: startOfCivilDay(parseCivilDateIso(formatCivilDateIso(period.periodStart))),
          periodEnd: startOfCivilDay(parseCivilDateIso(formatCivilDateIso(period.periodEnd))),
          expectedAmount: decimal(input.plannedWeeklyContribution).toString(),
          status: "DUE",
        },
      });
    }

    return plan;
  }, { timeout: 60_000 });

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "SAVINGS_PLAN_ACTIVATED",
    resourceType: "SavingsPlan",
    resourceId: result.id,
    outcome: "SUCCESS",
    source: "financial-service",
    metadata: { goalId: result.goalId, activationKey: input.idempotencyKey },
  });

  return { planId: result.id, reused: false };
}

export function defaultWizardFromTemplate(templateKey: string): SavingsPlanWizardInput | null {
  const template = getSavingsPlanTemplate(templateKey);
  if (!template) return null;
  return {
    templateKey,
    name: template.defaultName,
    targetAmount: template.targetAmount,
    targetDateIso: template.targetDateIso,
    plannedWeeklyContribution: template.plannedWeeklyContribution,
    contributionWeekday: template.contributionWeekday,
    reviewWeekday: template.reviewWeekday,
    alertThresholdPercent: template.alertThresholdPercent,
    createSavingsAccountName: template.defaultSavingsAccountName,
    budgetStartMode: "NEXT_MONTH",
    budgetLines: template.budgetLines.map((line: SavingsPlanBudgetTemplateLine) => ({
      categoryName: line.categoryName,
      monthlyLimit: line.monthlyLimit,
      nature: line.nature,
      behavior: line.behavior,
    })),
    confirmBudgetOverrides: false,
    idempotencyKey: template.templateKey,
  };
}

async function resolveSavingsPlanSourceAccountId(
  client: DbOrTx,
  workspaceId: string,
  plan: { sourceAccountId: string | null; savingsAccountId: string },
): Promise<string | null> {
  if (plan.sourceAccountId && plan.sourceAccountId !== plan.savingsAccountId) {
    const configured = await client.financialAccount.findFirst({
      where: {
        id: plan.sourceAccountId,
        workspaceId,
        isArchived: false,
      },
    });
    if (configured) return configured.id;
  }

  const candidates = await client.financialAccount.findMany({
    where: {
      workspaceId,
      isArchived: false,
      type: { in: ["CURRENT", "CASH"] },
      id: { not: plan.savingsAccountId },
    },
    orderBy: { name: "asc" },
  });
  if (candidates.length === 0) return null;

  const caixa = candidates.find((a) => /caixa/i.test(a.name));
  if (caixa) return caixa.id;

  const current = candidates.find((a) => a.type === "CURRENT");
  return current?.id ?? candidates[0]!.id;
}

async function ensureContributionTransfer(
  tx: Prisma.TransactionClient,
  userId: string,
  workspaceId: string,
  plan: { id: string; name: string; savingsAccountId: string; sourceAccountId: string | null },
  contribution: {
    id: string;
    amount: { toString(): string };
    contributedAt: Date;
    transferId: string | null;
  },
): Promise<boolean> {
  if (contribution.transferId) return false;

  const sourceAccountId = await resolveSavingsPlanSourceAccountId(tx, workspaceId, plan);
  if (!sourceAccountId) return false;

  const amount = decimal(contribution.amount.toString()).toString();
  const transferResult = await createTransferInTransaction(tx, userId, workspaceId, {
    fromAccountId: sourceAccountId,
    toAccountId: plan.savingsAccountId,
    amount,
    occurredAt: contribution.contributedAt,
    description: `Plano poupança: ${plan.name}`,
  });
  if (!transferResult.ok) return false;

  await tx.savingsGoalContribution.update({
    where: { id: contribution.id },
    data: { transferId: transferResult.transfer.id },
  });

  if (!plan.sourceAccountId) {
    await tx.savingsPlan.update({
      where: { id: plan.id },
      data: { sourceAccountId },
    });
  }

  return true;
}

export async function syncMissingSavingsPlanContributionTransfers(
  userId: string,
  workspaceId: string,
  planId: string,
): Promise<{ repaired: number } | null> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const plan = await db.savingsPlan.findFirst({
    where: { id: planId, workspaceId },
    include: {
      goal: { include: { contributions: { where: { transferId: null } } } },
    },
  });
  if (!plan || plan.goal.contributions.length === 0) {
    return { repaired: 0 };
  }

  let repaired = 0;
  for (const contribution of plan.goal.contributions) {
    const created = await db.$transaction(async (tx) =>
      ensureContributionTransfer(tx, userId, workspaceId, plan, contribution),
    );
    if (created) repaired += 1;
  }

  if (repaired > 0) {
    await appendAuditEvent({
      actorUserId: userId,
      workspaceId,
      action: "SAVINGS_PLAN_TRANSFERS_REPAIRED",
      resourceType: "SavingsPlan",
      resourceId: planId,
      outcome: "SUCCESS",
      source: "financial-service",
      metadata: { repaired },
    });
  }

  return { repaired };
}

export async function setSavingsPlanSourceAccount(
  userId: string,
  workspaceId: string,
  planId: string,
  sourceAccountId: string,
): Promise<boolean> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return false;

  const plan = await db.savingsPlan.findFirst({
    where: { id: planId, workspaceId },
  });
  if (!plan) return false;

  if (sourceAccountId === plan.savingsAccountId) return false;

  const source = await db.financialAccount.findFirst({
    where: {
      id: sourceAccountId,
      workspaceId,
      isArchived: false,
      type: { in: ["CURRENT", "CASH", "OTHER"] },
    },
  });
  if (!source) return false;

  await db.savingsPlan.update({
    where: { id: planId },
    data: { sourceAccountId: source.id },
  });
  return true;
}

export async function getSavingsPlanDashboardCard(
  userId: string,
  workspaceId: string,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const plan = await db.savingsPlan.findFirst({
    where: { workspaceId, status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] } },
    include: {
      goal: { include: { contributions: true } },
      savingsAccount: true,
      checkIns: { orderBy: { periodStart: "asc" } },
    },
    orderBy: { activatedAt: "desc" },
  });
  if (!plan) return null;

  const editor = await requireWorkspaceEditor(userId, workspaceId);
  if (editor) {
    await syncMissingSavingsPlanContributionTransfers(userId, workspaceId, plan.id);
    const refreshed = await db.savingsPlan.findFirst({
      where: { id: plan.id },
      include: {
        goal: { include: { contributions: true } },
        savingsAccount: true,
        checkIns: { orderBy: { periodStart: "asc" } },
      },
    });
    if (refreshed) {
      Object.assign(plan, refreshed);
    }
  }

  const today = civilDateFromInstant(new Date());
  const targetIso = plan.goal.targetDate
    ? formatCivilDateIso(civilDateFromInstant(plan.goal.targetDate))
    : null;
  const progress = computePlanProgress({
    targetAmount: plan.goal.targetAmount.toString(),
    contributionAmounts: plan.goal.contributions.map((c) => c.amount.toString()),
    targetDateIso: targetIso,
    asOf: new Date(),
  });

  const currentCheckIn =
    plan.checkIns.find((c) => c.status === "DUE") ??
    plan.checkIns.filter((c) => c.status === "COMPLETED").at(-1) ??
    null;

  const remainingWeeks = targetIso
    ? weeksRemaining(today, parseCivilDateIso(targetIso), plan.contributionWeekday)
    : 0;

  return {
    planId: plan.id,
    name: plan.name,
    status: plan.status,
    progress,
    remainingWeeks,
    weeklyExpected: plan.plannedContributionAmount.toString(),
    currentCheckIn: currentCheckIn
      ? {
          id: currentCheckIn.id,
          status: currentCheckIn.status,
          periodEnd: currentCheckIn.periodEnd,
        }
      : null,
    reviewWeekday: plan.reviewWeekday,
    savingsAccountArchived: plan.savingsAccount.isArchived,
    investmentGuardEnabled: plan.investmentGuardEnabled,
  };
}

export async function registerSavingsPlanWeeklyContribution(
  userId: string,
  workspaceId: string,
  input: {
    planId: string;
    checkInId: string;
    amount: string;
    contributedAt: Date;
    notes?: string;
    transferConfirmed: boolean;
  },
): Promise<{ contributionId: string; transferCreated?: boolean } | null> {
  if (!input.transferConfirmed) return null;
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const plan = await db.savingsPlan.findFirst({
    where: { id: input.planId, workspaceId, status: "ACTIVE" },
    include: { goal: true },
  });
  if (!plan) return null;

  const checkIn = await db.savingsPlanCheckIn.findFirst({
    where: {
      id: input.checkInId,
      savingsPlanId: plan.id,
      workspaceId,
    },
  });
  if (!checkIn || checkIn.status === "COMPLETED") {
    if (checkIn?.contributionId) {
      const repaired = await syncMissingSavingsPlanContributionTransfers(
        userId,
        workspaceId,
        plan.id,
      );
      return {
        contributionId: checkIn.contributionId,
        transferCreated: (repaired?.repaired ?? 0) > 0,
      };
    }
    return null;
  }

  const sourceAccountId = await resolveSavingsPlanSourceAccountId(db, workspaceId, plan);
  if (!sourceAccountId) return null;

  const amountStr = decimal(input.amount).toString();

  const result = await db.$transaction(async (tx) => {
    const transferResult = await createTransferInTransaction(tx, userId, workspaceId, {
      fromAccountId: sourceAccountId,
      toAccountId: plan.savingsAccountId,
      amount: amountStr,
      occurredAt: input.contributedAt,
      description: `Plano poupança: ${plan.name}`,
    });
    if (!transferResult.ok) {
      throw new Error(transferResult.reason);
    }

    const contribution = await tx.savingsGoalContribution.create({
      data: {
        workspaceId,
        goalId: plan.goalId,
        userId,
        amount: amountStr,
        contributedAt: input.contributedAt,
        notes: input.notes,
        transferId: transferResult.transfer.id,
      },
    });

    if (!plan.sourceAccountId) {
      await tx.savingsPlan.update({
        where: { id: plan.id },
        data: { sourceAccountId },
      });
    }
    await tx.savingsPlanCheckIn.update({
      where: { id: checkIn.id },
      data: {
        status: "COMPLETED",
        contributionId: contribution.id,
        completedAt: new Date(),
        notes: input.notes,
      },
    });
    const nextDue = await tx.savingsPlanCheckIn.findFirst({
      where: { savingsPlanId: plan.id, status: "DUE" },
      orderBy: { periodStart: "asc" },
    });
    const totalContributions = await tx.savingsGoalContribution.aggregate({
      where: { goalId: plan.goalId },
      _sum: { amount: true },
    });
    const contributedTotal = totalContributions._sum.amount?.toString() ?? "0";
    await tx.savingsPlan.update({
      where: { id: plan.id },
      data: {
        nextContributionDueAt: nextDue?.periodStart ?? null,
        status: decimal(contributedTotal).gte(plan.goal.targetAmount.toString())
          ? "COMPLETED"
          : "ACTIVE",
      },
    });
    return contribution;
  });

  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "SAVINGS_PLAN_CONTRIBUTION_CONFIRMED",
    resourceType: "SavingsGoalContribution",
    resourceId: result.id,
    outcome: "SUCCESS",
    source: "financial-service",
    metadata: { planId: plan.id, checkInId: checkIn.id },
  });

  return { contributionId: result.id, transferCreated: true };
}

export async function setSavingsPlanStatus(
  userId: string,
  workspaceId: string,
  planId: string,
  status: "PAUSED" | "ACTIVE" | "CANCELLED",
) {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;
  const plan = await db.savingsPlan.findFirst({ where: { id: planId, workspaceId } });
  if (!plan) return null;
  const updated = await db.savingsPlan.update({
    where: { id: planId },
    data: { status },
  });
  await appendAuditEvent({
    actorUserId: userId,
    workspaceId,
    action: "SAVINGS_PLAN_STATUS_CHANGED",
    resourceType: "SavingsPlan",
    resourceId: planId,
    outcome: "SUCCESS",
    source: "financial-service",
    metadata: { status },
  });
  return updated;
}

export async function getSavingsPlanDetail(userId: string, workspaceId: string, planId: string) {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;
  return db.savingsPlan.findFirst({
    where: { id: planId, workspaceId },
    include: {
      goal: { include: { contributions: { orderBy: { contributedAt: "desc" } } } },
      savingsAccount: true,
      budgetRules: { include: { category: true } },
      checkIns: { orderBy: { periodStart: "desc" }, include: { contribution: true } },
    },
  });
}

export async function loadSavingsPlanAlertContext(workspaceId: string, asOf: Date) {
  const plans = await db.savingsPlan.findMany({
    where: { workspaceId, status: "ACTIVE" },
    include: {
      goal: { include: { contributions: true } },
      budgetRules: { include: { category: true } },
      savingsAccount: true,
    },
  });
  if (plans.length === 0) return null;

  const civil = civilDateFromInstant(asOf);
  const checkIns = await db.savingsPlanCheckIn.findMany({
    where: { workspaceId, savingsPlanId: { in: plans.map((p) => p.id) }, status: "DUE" },
  });

  const accountIds = plans.map((p) => p.savingsAccountId);
  const withdrawals = await db.transaction.findMany({
    where: {
      workspaceId,
      accountId: { in: accountIds },
      status: "COMPLETED",
      deletedAt: null,
      amount: { lt: 0 },
      occurredAt: { gte: new Date(asOf.getTime() - 90 * 86_400_000) },
    },
    include: { account: true },
  });

  return {
    plans: plans.map((p) => ({
      planId: p.id,
      planName: p.name,
      goalId: p.goalId,
      savingsAccountId: p.savingsAccountId,
      status: p.status,
      alertThresholdPercent: p.alertThresholdPercent,
      targetAmount: p.goal.targetAmount.toString(),
      targetDateIso: p.goal.targetDate
        ? formatCivilDateIso(civilDateFromInstant(p.goal.targetDate))
        : null,
      contributionAmounts: p.goal.contributions.map((c) => c.amount.toString()),
      budgetRules: p.budgetRules.map((r) => ({
        categoryId: r.categoryId,
        categoryName: r.category.name,
        monthlyLimit: r.monthlyLimitAmount.toString(),
        alertThresholdPercent: r.alertThresholdPercent,
      })),
    })),
    checkIns: checkIns.map((c) => ({
      checkInId: c.id,
      planId: c.savingsPlanId,
      periodStart: c.periodStart,
      periodEnd: c.periodEnd,
      status: c.status,
      expectedAmount: c.expectedAmount.toString(),
    })),
    withdrawals: withdrawals.flatMap((tx) =>
      plans
        .filter((p) => p.savingsAccountId === tx.accountId)
        .map((p) => ({
          transactionId: tx.id,
          amount: tx.amount.toString(),
          occurredAt: tx.occurredAt,
          description: tx.description,
          accountName: tx.account.name,
          planId: p.id,
        })),
    ),
    civilYear: civil.year,
    civilMonth: civil.month,
  };
}

export type { WeeklyReviewSnapshot, SavingsPlanReportSection };

export async function getWeeklyReviewForPlan(
  userId: string,
  workspaceId: string,
  planId: string,
): Promise<WeeklyReviewSnapshot | null> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const plan = await db.savingsPlan.findFirst({
    where: { id: planId, workspaceId, status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] } },
    include: {
      goal: { include: { contributions: true } },
      budgetRules: { include: { category: true } },
      checkIns: { orderBy: { periodStart: "asc" } },
      savingsAccount: true,
    },
  });
  if (!plan) return null;

  const asOf = new Date();
  const today = civilDateFromInstant(asOf);
  const civil = today;
  const { getBudgetOverview } = await import("@/server/services/budgets");
  const budget = await getBudgetOverview(userId, workspaceId, civil.year, civil.month);
  const ruleCategoryIds = new Set(plan.budgetRules.map((r) => r.categoryId));
  const budgetLines: BudgetLineSnapshot[] =
    budget?.lines
      .filter((line) => ruleCategoryIds.has(line.categoryId))
      .map((line) => ({
        categoryId: line.categoryId,
        categoryName: line.categoryName,
        limitAmount: line.limitAmount,
        spentAmount: line.spentAmount,
      })) ?? [];

  const weekStart = plan.checkIns.find((c) => {
    const start = civilDateFromInstant(c.periodStart);
    const end = civilDateFromInstant(c.periodEnd);
    return (
      today.year > start.year ||
      (today.year === start.year && today.month > start.month) ||
      (today.year === start.year && today.month === start.month && today.day >= start.day)
    ) && (
      today.year < end.year ||
      (today.year === end.year && today.month < end.month) ||
      (today.year === end.year && today.month === end.month && today.day <= end.day)
    );
  });

  const withdrawals = await db.transaction.findMany({
    where: {
      workspaceId,
      accountId: plan.savingsAccountId,
      status: "COMPLETED",
      deletedAt: null,
      amount: { lt: 0 },
    },
    orderBy: { occurredAt: "desc" },
    take: 20,
  });

  const withdrawalsThisWeek = withdrawals.filter((tx) => {
    if (!weekStart) return false;
    return (
      tx.occurredAt >= weekStart.periodStart && tx.occurredAt <= weekStart.periodEnd
    );
  });

  const targetIso = plan.goal.targetDate
    ? formatCivilDateIso(civilDateFromInstant(plan.goal.targetDate))
    : null;

  return buildWeeklyReviewSnapshot({
    asOf,
    today,
    reviewWeekday: plan.reviewWeekday,
    targetAmount: plan.goal.targetAmount.toString(),
    targetDateIso: targetIso,
    contributionAmounts: plan.goal.contributions.map((c) => c.amount.toString()),
    plannedWeeklyContribution: plan.plannedContributionAmount.toString(),
    checkIns: plan.checkIns.map((c) => ({
      status: c.status,
      expectedAmount: c.expectedAmount.toString(),
      periodStartIso: formatCivilDateIso(civilDateFromInstant(c.periodStart)),
      periodEndIso: formatCivilDateIso(civilDateFromInstant(c.periodEnd)),
    })),
    budgetLines,
    alertThresholdPercent: plan.alertThresholdPercent,
    withdrawalsThisWeek: withdrawalsThisWeek.map((tx) => ({
      amount: tx.amount.toString(),
      occurredAtIso: formatCivilDateIso(civilDateFromInstant(tx.occurredAt)),
      description: tx.description,
    })),
  });
}

export async function buildSavingsPlanReportSectionForPeriod(
  userId: string,
  workspaceId: string,
  year: number,
  month: number,
): Promise<SavingsPlanReportSection | null> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const plan = await db.savingsPlan.findFirst({
    where: {
      workspaceId,
      status: { in: ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] },
    },
    include: {
      goal: { include: { contributions: true } },
      budgetRules: { include: { category: true } },
      checkIns: true,
      savingsAccount: true,
    },
    orderBy: { activatedAt: "desc" },
  });
  if (!plan) return null;

  const { getBudgetOverview } = await import("@/server/services/budgets");
  const budget = await getBudgetOverview(userId, workspaceId, year, month);
  const ruleCategoryIds = new Set(plan.budgetRules.map((r) => r.categoryId));
  const budgetLines: BudgetLineSnapshot[] =
    budget?.lines
      .filter((line) => ruleCategoryIds.has(line.categoryId))
      .map((line) => ({
        categoryId: line.categoryId,
        categoryName: line.categoryName,
        limitAmount: line.limitAmount,
        spentAmount: line.spentAmount,
      })) ?? [];

  const contributionsInMonth = plan.goal.contributions.filter((c) =>
    isInstantInCivilMonth(c.contributedAt, year, month),
  );

  const withdrawalsInMonth = await db.transaction.findMany({
    where: {
      workspaceId,
      accountId: plan.savingsAccountId,
      status: "COMPLETED",
      deletedAt: null,
      amount: { lt: 0 },
    },
  });
  const withdrawalsFiltered = withdrawalsInMonth.filter((tx) =>
    isInstantInCivilMonth(tx.occurredAt, year, month),
  );

  const targetIso = plan.goal.targetDate
    ? formatCivilDateIso(civilDateFromInstant(plan.goal.targetDate))
    : null;

  return buildSavingsPlanReportSection({
    planName: plan.name,
    targetAmount: plan.goal.targetAmount.toString(),
    targetDateIso: targetIso,
    plannedWeeklyContribution: plan.plannedContributionAmount.toString(),
    contributionWeekday: plan.contributionWeekday,
    year,
    month,
    asOf: new Date(),
    checkIns: plan.checkIns.map((c) => ({
      status: c.status,
      expectedAmount: c.expectedAmount.toString(),
      periodStart: c.periodStart,
      periodEnd: c.periodEnd,
      contributionAmount: null,
    })),
    contributionsInMonth: contributionsInMonth.map((c) => ({
      amount: c.amount.toString(),
      contributedAt: c.contributedAt,
    })),
    budgetLines,
    withdrawalsInMonth: withdrawalsFiltered.map((tx) => ({
      amount: tx.amount.toString(),
      occurredAt: tx.occurredAt,
      description: tx.description,
    })),
    allContributionAmounts: plan.goal.contributions.map((c) => c.amount.toString()),
  });
}
