import {
  civilDateFromInstant,
  formatCivilDate,
  startOfCivilDay,
} from "@/lib/datetime/civil-date";
import {
  budgetOverage,
  budgetUtilizationPercent,
  type BudgetLineSnapshot,
} from "@/lib/finance/budget";
import {
  alertDedupeKey,
  type AlertCandidate,
  type AlertSeverity,
} from "@/lib/finance/financial-alerts";
import { computePlanProgress } from "@/lib/finance/savings-plan-engine";
import { decimal } from "@/lib/finance/money";

export type SavingsPlanAlertPlanSnapshot = {
  planId: string;
  planName: string;
  goalId: string;
  savingsAccountId: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "DRAFT";
  alertThresholdPercent: number;
  targetAmount: string;
  targetDateIso: string | null;
  contributionAmounts: readonly string[];
  budgetRules: readonly {
    categoryId: string;
    categoryName: string;
    monthlyLimit: string;
    alertThresholdPercent: number;
  }[];
};

export type SavingsPlanCheckInSnapshot = {
  checkInId: string;
  planId: string;
  periodStart: Date;
  periodEnd: Date;
  status: "DUE" | "COMPLETED" | "MISSED" | "SKIPPED";
  expectedAmount: string;
};

export type SavingsPlanWithdrawalSnapshot = {
  planId: string;
  transactionId: string;
  amount: string;
  occurredAt: Date;
  description: string | null;
  accountName: string;
};

export type SavingsPlanAlertsInput = {
  workspaceId: string;
  asOf: Date;
  plans: readonly SavingsPlanAlertPlanSnapshot[];
  checkIns: readonly SavingsPlanCheckInSnapshot[];
  budgetLinesByCategory: ReadonlyMap<string, BudgetLineSnapshot>;
  withdrawals: readonly SavingsPlanWithdrawalSnapshot[];
  civilYear: number;
  civilMonth: number;
};

function severityForBudget(util: number | null, threshold: number): AlertSeverity {
  if (util == null) return "INFO";
  if (util >= 100) return "HIGH";
  if (util >= threshold) return "ATTENTION";
  return "INFO";
}

export function evaluateSavingsPlanAlertCandidates(
  input: SavingsPlanAlertsInput,
): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  const activePlans = input.plans.filter((p) => p.status === "ACTIVE");

  for (const plan of activePlans) {
    for (const rule of plan.budgetRules) {
      const line = input.budgetLinesByCategory.get(rule.categoryId);
      if (!line) continue;
      const util = budgetUtilizationPercent(line.limitAmount, line.spentAmount);
      const threshold = rule.alertThresholdPercent;
      if (util != null && util >= threshold && util < 100) {
        out.push({
          type: "BUDGET_NEAR_LIMIT",
          severity: severityForBudget(util, threshold),
          title: `${rule.categoryName} a ${util}% (plano ${plan.planName})`,
          description: `A categoria "${rule.categoryName}" atingiu ${util}% do limite mensal definido no plano de poupança (alerta aos ${threshold}%).`,
          deduplicationKey: alertDedupeKey(input.workspaceId, "BUDGET_NEAR_LIMIT", [
            "savings-plan",
            plan.planId,
            rule.categoryId,
            String(input.civilYear),
            String(input.civilMonth),
            "near",
          ]),
          sourceType: "SavingsPlan",
          sourceId: plan.planId,
          actionUrl: `/planeamento/plano-poupanca/${plan.planId}`,
          evidence: { utilizationPercent: util, thresholdPercent: threshold },
        });
      }
      const over = budgetOverage(line.limitAmount, line.spentAmount);
      if (over && decimal(over).gt(0)) {
        out.push({
          type: "BUDGET_EXCEEDED",
          severity: "HIGH",
          title: `${rule.categoryName} excedeu o orçamento (plano)`,
          description: `A categoria "${rule.categoryName}" ultrapassou o limite mensal do plano "${plan.planName}".`,
          deduplicationKey: alertDedupeKey(input.workspaceId, "BUDGET_EXCEEDED", [
            "savings-plan",
            plan.planId,
            rule.categoryId,
            String(input.civilYear),
            String(input.civilMonth),
          ]),
          sourceType: "SavingsPlan",
          sourceId: plan.planId,
          actionUrl: `/orcamentos`,
        });
      }
    }

    const progress = computePlanProgress({
      targetAmount: plan.targetAmount,
      contributionAmounts: plan.contributionAmounts,
      targetDateIso: plan.targetDateIso,
      asOf: input.asOf,
    });
    if (progress.targetReached) {
      out.push({
        type: "SAVINGS_PLAN_COMPLETED",
        severity: "INFO",
        title: `Objetivo concluído: ${plan.planName}`,
        description: `Parabéns — atingiste ${plan.targetAmount} € no plano "${plan.planName}".`,
        deduplicationKey: alertDedupeKey(input.workspaceId, "SAVINGS_PLAN_COMPLETED", [
          plan.planId,
        ]),
        sourceType: "SavingsPlan",
        sourceId: plan.planId,
        actionUrl: `/planeamento/plano-poupanca/${plan.planId}`,
      });
    }

    for (const checkIn of input.checkIns.filter((c) => c.planId === plan.planId)) {
      if (checkIn.status !== "DUE") continue;
      const periodEndDay = startOfCivilDay(civilDateFromInstant(checkIn.periodEnd));
      const today = startOfCivilDay(civilDateFromInstant(input.asOf));
      if (today.getTime() <= periodEndDay.getTime()) {
        out.push({
          type: "SAVINGS_PLAN_CONTRIBUTION_DUE",
          severity: "ATTENTION",
          title: `Contribuição semanal pendente (${plan.planName})`,
          description: `Confirma a poupança desta semana (${formatEURAmount(checkIn.expectedAmount)}) até ${formatCivilDate(civilDateFromInstant(checkIn.periodEnd))}.`,
          deduplicationKey: alertDedupeKey(input.workspaceId, "SAVINGS_PLAN_CONTRIBUTION_DUE", [
            plan.planId,
            checkIn.periodStart.toISOString(),
          ]),
          sourceType: "SavingsPlanCheckIn",
          sourceId: checkIn.checkInId,
          periodStart: checkIn.periodStart,
          periodEnd: checkIn.periodEnd,
          actionUrl: `/planeamento/plano-poupanca/${plan.planId}`,
        });
      } else {
        out.push({
          type: "SAVINGS_PLAN_CONTRIBUTION_MISSED",
          severity: "HIGH",
          title: `Contribuição semanal em falta (${plan.planName})`,
          description: `A semana terminada a ${formatCivilDate(civilDateFromInstant(checkIn.periodEnd))} não tem contribuição confirmada.`,
          deduplicationKey: alertDedupeKey(input.workspaceId, "SAVINGS_PLAN_CONTRIBUTION_MISSED", [
            plan.planId,
            checkIn.periodStart.toISOString(),
          ]),
          sourceType: "SavingsPlanCheckIn",
          sourceId: checkIn.checkInId,
          actionUrl: `/planeamento/plano-poupanca/${plan.planId}`,
        });
      }
    }

    for (const tx of input.withdrawals.filter((w) => w.planId === plan.planId)) {
      out.push({
        type: "SAVINGS_PLAN_ACCOUNT_WITHDRAWAL",
        severity: "HIGH",
        title: `Saída da conta protegida (${plan.planName})`,
        description: `Movimento de ${formatEURAmount(tx.amount)} em ${formatCivilDate(civilDateFromInstant(tx.occurredAt))}: ${tx.description ?? "Sem descrição"}.`,
        deduplicationKey: alertDedupeKey(input.workspaceId, "SAVINGS_PLAN_ACCOUNT_WITHDRAWAL", [
          plan.planId,
          tx.transactionId,
        ]),
        sourceType: "Transaction",
        sourceId: tx.transactionId,
        actionUrl: `/transacoes`,
        evidence: {
          accountName: tx.accountName,
          impactOnGoal: progress.amountRemaining,
        },
      });
    }
  }

  return out;
}

function formatEURAmount(raw: string): string {
  return `${decimal(raw).abs().toFixed(2)} €`;
}
