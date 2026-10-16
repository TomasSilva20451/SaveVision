import {
  civilDateFromInstant,
  formatCivilDateIso,
  startOfCivilDay,
} from "@/lib/datetime/civil-date";
import {
  budgetOverage,
  budgetUtilizationPercent,
  type BudgetLineSnapshot,
} from "@/lib/finance/budget";
import type { FinancialInsight } from "@/lib/finance/financial-insights";
import { decimal } from "@/lib/finance/money";
import type { TreasuryProjectionPoint } from "@/lib/finance/treasury-forecast";

export const ALERT_LOW_BALANCE_THRESHOLD_EUR = "100.00";
export const ALERT_BUDGET_NEAR_LIMIT_PERCENT = 85;
export const ALERT_RECURRING_DUE_SOON_DAYS = 3;
export const ALERT_TREASURY_HORIZON_DAYS = 30;

export type AlertSeverity = "INFO" | "ATTENTION" | "HIGH" | "CRITICAL";

export type AlertType =
  | "LOW_PROJECTED_BALANCE"
  | "NEGATIVE_PROJECTED_BALANCE"
  | "BUDGET_NEAR_LIMIT"
  | "BUDGET_EXCEEDED"
  | "RECURRING_EXPENSE_DUE"
  | "RECURRING_EXPENSE_OVERDUE"
  | "EXPECTED_INCOME_OVERDUE"
  | "UNUSUAL_EXPENSE"
  | "EMERGENCY_FUND_BELOW_TARGET"
  | "RECURRING_LIABILITY_CONFIGURATION"
  | "DUPLICATE_PAYMENT_RISK";

export type AlertCandidate = {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  deduplicationKey: string;
  sourceType?: string;
  sourceId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  evidence?: Record<string, unknown>;
  actionUrl?: string;
};

export type RecurringOccurrenceAlertSnapshot = {
  occurrenceId: string;
  recurringId: string;
  name: string;
  dueDate: Date;
  status: "EXPECTED" | "POSTPONED";
  expectedAmount: string;
};

export type OverdueIncomeSnapshot = {
  occurrenceId: string;
  label: string;
  scheduledFor: Date;
  expectedAmount: string;
};

export type LinkedRecurringRiskSnapshot = {
  recurringId: string;
  recurringName: string;
  liabilityId: string;
  liabilityTitle: string;
};

export type FinancialAlertsEvaluationInput = {
  workspaceId: string;
  civilYear: number;
  civilMonth: number;
  treasuryTimeline30: readonly TreasuryProjectionPoint[];
  realBalance: string;
  budgetLines: readonly BudgetLineSnapshot[];
  recurringDueSoon: readonly RecurringOccurrenceAlertSnapshot[];
  recurringOverdue: readonly RecurringOccurrenceAlertSnapshot[];
  overdueIncome: readonly OverdueIncomeSnapshot[];
  emergencyFundCurrent: string | null;
  emergencyFundTarget: string | null;
  configurationWarnings: readonly { recurringId?: string; message: string }[];
  linkedRecurringRisks: readonly LinkedRecurringRiskSnapshot[];
  anomalyInsights: readonly FinancialInsight[];
  asOf: Date;
};

export function alertDedupeKey(
  workspaceId: string,
  type: AlertType,
  parts: readonly string[],
): string {
  return `${workspaceId}:${type}:${parts.join(":")}`;
}

export function minProjectedBalanceInTimeline(
  timeline: readonly TreasuryProjectionPoint[],
): { minBalance: string; civilDate: string } | null {
  if (timeline.length === 0) return null;
  let min = decimal(timeline[0]!.projectedBalance);
  let date = timeline[0]!.civilDate;
  for (const point of timeline) {
    const bal = decimal(point.projectedBalance);
    if (bal.lt(min)) {
      min = bal;
      date = point.civilDate;
    }
  }
  return { minBalance: min.toFixed(2), civilDate: date };
}

function periodMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function evaluateTreasuryAlerts(input: FinancialAlertsEvaluationInput): AlertCandidate[] {
  const minInfo = minProjectedBalanceInTimeline(input.treasuryTimeline30);
  if (!minInfo) return [];

  const minBal = decimal(minInfo.minBalance);
  const threshold = decimal(ALERT_LOW_BALANCE_THRESHOLD_EUR);
  const out: AlertCandidate[] = [];

  if (minBal.lt(0)) {
    out.push({
      type: "NEGATIVE_PROJECTED_BALANCE",
      severity: "CRITICAL",
      title: "Saldo projetado insuficiente",
      description:
        `Com base nos movimentos conhecidos, o saldo agregado poderá atingir ${minBal.toFixed(2)} € ` +
        `durante os próximos ${ALERT_TREASURY_HORIZON_DAYS} dias (mínimo em ${minInfo.civilDate}). ` +
        "Isto é uma projeção, não uma garantia.",
      deduplicationKey: alertDedupeKey(input.workspaceId, "NEGATIVE_PROJECTED_BALANCE", [
        `${ALERT_TREASURY_HORIZON_DAYS}d`,
      ]),
      sourceType: "treasury",
      evidence: {
        realBalance: input.realBalance,
        minProjectedBalance: minInfo.minBalance,
        minDate: minInfo.civilDate,
        horizonDays: ALERT_TREASURY_HORIZON_DAYS,
      },
      actionUrl: "/previsoes",
    });
  } else if (minBal.lt(threshold)) {
    out.push({
      type: "LOW_PROJECTED_BALANCE",
      severity: "ATTENTION",
      title: "Saldo projetado abaixo do limiar",
      description:
        `O saldo agregado projetado poderá ficar abaixo de ${threshold.toFixed(2)} € ` +
        `(mínimo previsto ${minInfo.minBalance} € em ${minInfo.civilDate}) nos próximos ` +
        `${ALERT_TREASURY_HORIZON_DAYS} dias.`,
      deduplicationKey: alertDedupeKey(input.workspaceId, "LOW_PROJECTED_BALANCE", [
        `${ALERT_TREASURY_HORIZON_DAYS}d`,
      ]),
      sourceType: "treasury",
      evidence: {
        realBalance: input.realBalance,
        minProjectedBalance: minInfo.minBalance,
        threshold: ALERT_LOW_BALANCE_THRESHOLD_EUR,
        minDate: minInfo.civilDate,
      },
      actionUrl: "/previsoes",
    });
  }

  return out;
}

function evaluateBudgetAlerts(input: FinancialAlertsEvaluationInput): AlertCandidate[] {
  const periodKey = periodMonthKey(input.civilYear, input.civilMonth);
  const periodStart = startOfCivilDay({
    year: input.civilYear,
    month: input.civilMonth,
    day: 1,
  });
  const out: AlertCandidate[] = [];

  for (const line of input.budgetLines) {
    const util = budgetUtilizationPercent(line.limitAmount, line.spentAmount);
    const overStr = budgetOverage(line.limitAmount, line.spentAmount);
    const over = decimal(overStr);
    if (over.gt(0)) {
      out.push({
        type: "BUDGET_EXCEEDED",
        severity: "ATTENTION",
        title: `Orçamento de ${line.categoryName} ultrapassado`,
        description:
          `As despesas realizadas (${decimal(line.spentAmount).toFixed(2)} €) excederam o limite ` +
          `(${decimal(line.limitAmount).toFixed(2)} €) em ${over.toFixed(2)} €.`,
        deduplicationKey: alertDedupeKey(input.workspaceId, "BUDGET_EXCEEDED", [
          periodKey,
          line.categoryId,
        ]),
        sourceType: "MonthlyBudgetLine",
        sourceId: line.categoryId,
        periodStart,
        evidence: {
          categoryName: line.categoryName,
          limit: line.limitAmount,
          spent: line.spentAmount,
          overage: over.toFixed(2),
          utilizationPercent: util,
        },
        actionUrl: "/orcamentos",
      });
    } else if (util != null && util >= ALERT_BUDGET_NEAR_LIMIT_PERCENT) {
      out.push({
        type: "BUDGET_NEAR_LIMIT",
        severity: "INFO",
        title: `Orçamento de ${line.categoryName} próximo do limite`,
        description:
          `Já foram utilizados ${util.toFixed(1)}% do orçamento mensal ` +
          `(${decimal(line.spentAmount).toFixed(2)} € de ${decimal(line.limitAmount).toFixed(2)} €).`,
        deduplicationKey: alertDedupeKey(input.workspaceId, "BUDGET_NEAR_LIMIT", [
          periodKey,
          line.categoryId,
        ]),
        sourceType: "MonthlyBudgetLine",
        sourceId: line.categoryId,
        periodStart,
        evidence: {
          categoryName: line.categoryName,
          limit: line.limitAmount,
          spent: line.spentAmount,
          utilizationPercent: util,
        },
        actionUrl: "/orcamentos",
      });
    }
  }

  return out;
}

function formatDueLabel(due: Date): string {
  const civil = formatCivilDateIso(civilDateFromInstant(due));
  const [y, m, d] = civil.split("-");
  return `${d}/${m}/${y}`;
}

function evaluateRecurringAlerts(input: FinancialAlertsEvaluationInput): AlertCandidate[] {
  const out: AlertCandidate[] = [];

  for (const row of input.recurringOverdue) {
    out.push({
      type: "RECURRING_EXPENSE_OVERDUE",
      severity: "HIGH",
      title: `${row.name} vencida`,
      description:
        `A despesa recorrente «${row.name}» (${decimal(row.expectedAmount).toFixed(2)} €) ` +
        `venceu a ${formatDueLabel(row.dueDate)} e ainda não foi confirmada.`,
      deduplicationKey: alertDedupeKey(input.workspaceId, "RECURRING_EXPENSE_OVERDUE", [
        row.occurrenceId,
      ]),
      sourceType: "RecurringExpenseOccurrence",
      sourceId: row.occurrenceId,
      evidence: {
        recurringId: row.recurringId,
        dueDate: row.dueDate.toISOString(),
        expectedAmount: row.expectedAmount,
        status: row.status,
      },
      actionUrl: "/despesas-recorrentes",
    });
  }

  for (const row of input.recurringDueSoon) {
    out.push({
      type: "RECURRING_EXPENSE_DUE",
      severity: "ATTENTION",
      title: `${row.name} a vencer em breve`,
      description:
        `A despesa «${row.name}» (${decimal(row.expectedAmount).toFixed(2)} €) vence a ` +
        `${formatDueLabel(row.dueDate)}.`,
      deduplicationKey: alertDedupeKey(input.workspaceId, "RECURRING_EXPENSE_DUE", [
        row.occurrenceId,
      ]),
      sourceType: "RecurringExpenseOccurrence",
      sourceId: row.occurrenceId,
      evidence: {
        recurringId: row.recurringId,
        dueDate: row.dueDate.toISOString(),
        expectedAmount: row.expectedAmount,
      },
      actionUrl: "/despesas-recorrentes",
    });
  }

  return out;
}

function evaluateIncomeAlerts(input: FinancialAlertsEvaluationInput): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  for (const row of input.overdueIncome) {
    out.push({
      type: "EXPECTED_INCOME_OVERDUE",
      severity: "ATTENTION",
      title: "Receita prevista por confirmar",
      description:
        `«${row.label}» (${decimal(row.expectedAmount).toFixed(2)} €) estava prevista para ` +
        `${formatDueLabel(row.scheduledFor)} e ainda não foi confirmada.`,
      deduplicationKey: alertDedupeKey(input.workspaceId, "EXPECTED_INCOME_OVERDUE", [
        row.occurrenceId,
      ]),
      sourceType: "IncomeOccurrence",
      sourceId: row.occurrenceId,
      evidence: {
        scheduledFor: row.scheduledFor.toISOString(),
        expectedAmount: row.expectedAmount,
      },
      actionUrl: "/receitas",
    });
  }
  return out;
}

function evaluateEmergencyAlert(input: FinancialAlertsEvaluationInput): AlertCandidate[] {
  if (input.emergencyFundCurrent == null || input.emergencyFundTarget == null) {
    return [];
  }
  const current = decimal(input.emergencyFundCurrent);
  const target = decimal(input.emergencyFundTarget);
  if (target.lte(0) || current.gte(target)) return [];

  return [
    {
      type: "EMERGENCY_FUND_BELOW_TARGET",
      severity: "ATTENTION",
      title: "Fundo de emergência abaixo do objetivo",
      description:
        `A reserva disponível (${current.toFixed(2)} €) está abaixo do objetivo configurado ` +
        `(${target.toFixed(2)} €).`,
      deduplicationKey: alertDedupeKey(input.workspaceId, "EMERGENCY_FUND_BELOW_TARGET", [
        periodMonthKey(input.civilYear, input.civilMonth),
      ]),
      sourceType: "WorkspacePlanningSettings",
      evidence: {
        current: current.toFixed(2),
        target: target.toFixed(2),
        gap: target.minus(current).toFixed(2),
      },
      actionUrl: "/planeamento",
    },
  ];
}

function evaluateConfigAlerts(input: FinancialAlertsEvaluationInput): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  for (const w of input.configurationWarnings) {
    const id = w.recurringId ?? w.message.slice(0, 32);
    out.push({
      type: "RECURRING_LIABILITY_CONFIGURATION",
      severity: "ATTENTION",
      title: "Configuração passivo / recorrência",
      description: w.message,
      deduplicationKey: alertDedupeKey(input.workspaceId, "RECURRING_LIABILITY_CONFIGURATION", [
        id,
      ]),
      sourceType: w.recurringId ? "RecurringExpense" : "FinancialLiability",
      sourceId: w.recurringId,
      actionUrl: "/previsoes",
    });
  }
  return out;
}

function evaluateDuplicateRiskAlerts(input: FinancialAlertsEvaluationInput): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  for (const row of input.linkedRecurringRisks) {
    out.push({
      type: "DUPLICATE_PAYMENT_RISK",
      severity: "HIGH",
      title: "Risco de pagamento duplicado",
      description:
        `A recorrência «${row.recurringName}» está associada ao passivo «${row.liabilityTitle}». ` +
        "Confirmar a recorrência com movimento bancário e registar um pagamento WITH_BANK separado " +
        "para o mesmo passivo pode duplicar a saída de caixa.",
      deduplicationKey: alertDedupeKey(input.workspaceId, "DUPLICATE_PAYMENT_RISK", [
        row.recurringId,
      ]),
      sourceType: "RecurringExpense",
      sourceId: row.recurringId,
      evidence: {
        liabilityId: row.liabilityId,
        liabilityTitle: row.liabilityTitle,
      },
      actionUrl: "/despesas-recorrentes",
    });
  }
  return out;
}

function insightToAnomalyAlert(
  workspaceId: string,
  insight: FinancialInsight,
  civilYear: number,
  civilMonth: number,
): AlertCandidate | null {
  if (insight.type !== "ANOMALY") {
    return null;
  }
  if (insight.severity !== "WARNING" && insight.severity !== "ATTENTION") {
    return null;
  }
  return {
    type: "UNUSUAL_EXPENSE",
    severity: insight.severity === "WARNING" ? "ATTENTION" : "INFO",
    title: insight.title,
    description: insight.description,
    deduplicationKey: alertDedupeKey(workspaceId, "UNUSUAL_EXPENSE", [
      periodMonthKey(civilYear, civilMonth),
      insight.id,
    ]),
    sourceType: "FinancialInsight",
    sourceId: insight.id,
    evidence: {
      evidenceLines: insight.evidence,
      triggerMetric: insight.triggerMetric,
      periodLabel: insight.periodLabel,
    },
    actionUrl: insight.linkHref ?? "/analises",
  };
}

export function evaluateFinancialAlertCandidates(
  input: FinancialAlertsEvaluationInput,
): AlertCandidate[] {
  const merged: AlertCandidate[] = [
    ...evaluateTreasuryAlerts(input),
    ...evaluateBudgetAlerts(input),
    ...evaluateRecurringAlerts(input),
    ...evaluateIncomeAlerts(input),
    ...evaluateEmergencyAlert(input),
    ...evaluateConfigAlerts(input),
    ...evaluateDuplicateRiskAlerts(input),
  ];

  for (const insight of input.anomalyInsights) {
    const row = insightToAnomalyAlert(
      input.workspaceId,
      insight,
      input.civilYear,
      input.civilMonth,
    );
    if (row) merged.push(row);
  }

  return merged;
}

export function severityRank(severity: AlertSeverity): number {
  switch (severity) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "ATTENTION":
      return 2;
    default:
      return 1;
  }
}

export function compareAlertsByRelevance(
  a: { severity: AlertSeverity; detectedAt: Date },
  b: { severity: AlertSeverity; detectedAt: Date },
): number {
  const diff = severityRank(b.severity) - severityRank(a.severity);
  if (diff !== 0) return diff;
  return b.detectedAt.getTime() - a.detectedAt.getTime();
}

export function isOccurrenceOverdue(dueDate: Date, asOf: Date): boolean {
  const due = startOfCivilDay(civilDateFromInstant(dueDate));
  const now = startOfCivilDay(civilDateFromInstant(asOf));
  return due.getTime() < now.getTime();
}

export function isOccurrenceDueSoon(
  dueDate: Date,
  asOf: Date,
  withinDays: number = ALERT_RECURRING_DUE_SOON_DAYS,
): boolean {
  const start = startOfCivilDay(civilDateFromInstant(asOf)).getTime();
  const due = startOfCivilDay(civilDateFromInstant(dueDate)).getTime();
  if (due < start) return false;
  const limit = start + withinDays * 86_400_000;
  return due <= limit;
}
