import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  civilDateFromInstant,
  startOfCivilMonth,
  startOfNextCivilMonth,
} from "@/lib/datetime/civil-date";
import { db } from "@/lib/db";
import {
  alertSeverityGuidePt,
  buildDeterministicExplanation,
  evidenceRecordToLines,
  insightSeverityGuidePt,
  type NaturalLanguageExplanation,
  type StructuredExplanationPayload,
} from "@/lib/finance/natural-language-explanation";
import type { FinancialInsight } from "@/lib/finance/financial-insights";
import { decimal, formatEUR } from "@/lib/finance/money";
import { explainWithOllama } from "@/server/providers/ollama-natural-language-explanation";
import type { FinancialAlertView } from "@/server/services/financial-alerts";
import { getFinancialInsightsOverview } from "@/server/services/financial-insights";

function actionLabelFromUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/orcamentos")) return "Ver orçamento";
  if (url.startsWith("/contas")) return "Ver conta";
  if (url.startsWith("/despesas-recorrentes")) return "Ver despesa recorrente";
  if (url.startsWith("/receitas")) return "Ver receitas";
  if (url.startsWith("/analises")) return "Ver análises";
  if (url.startsWith("/previsoes")) return "Ver previsões";
  if (url.startsWith("/patrimonio")) return "Ver património";
  return "Ver detalhes";
}

async function topMovementsForBudgetCategory(
  workspaceId: string,
  categoryId: string,
  periodStart: Date | null,
): Promise<StructuredExplanationPayload["topMovements"]> {
  if (!periodStart) return [];
  const civil = civilDateFromInstant(periodStart);
  const from = startOfCivilMonth(civil.year, civil.month);
  const to = startOfNextCivilMonth(civil.year, civil.month);

  const rows = await db.transaction.findMany({
    where: {
      workspaceId,
      type: "EXPENSE",
      status: "COMPLETED",
      deletedAt: null,
      categoryId,
      occurredAt: { gte: from, lte: to },
    },
    orderBy: { amount: "asc" },
    take: 12,
    select: { occurredAt: true, description: true, amount: true },
  });

  return rows
    .map((row) => ({
      date: civilDateFromInstant(row.occurredAt).day.toString().padStart(2, "0"),
      description: (row.description ?? "Movimento").slice(0, 80),
      amount: decimal(row.amount).abs().toFixed(2),
    }))
    .sort((a, b) => decimal(b.amount).cmp(decimal(a.amount)))
    .slice(0, 5);
}

async function spentInCategoryMonth(
  workspaceId: string,
  categoryId: string,
  year: number,
  month: number,
): Promise<string | null> {
  const from = startOfCivilMonth(year, month);
  const to = startOfNextCivilMonth(year, month);
  const rows = await db.transaction.findMany({
    where: {
      workspaceId,
      categoryId,
      type: "EXPENSE",
      status: "COMPLETED",
      deletedAt: null,
      occurredAt: { gte: from, lt: to },
    },
    select: { amount: true },
  });
  if (rows.length === 0) return null;
  const total = rows.reduce(
    (sum, row) => sum.add(decimal(row.amount).abs()),
    decimal(0),
  );
  return total.toFixed(2);
}

async function priorBudgetComparison(
  workspaceId: string,
  categoryId: string,
  periodStart: Date | null,
): Promise<string | null> {
  if (!periodStart) return null;
  const civil = civilDateFromInstant(periodStart);
  let prevMonth = civil.month - 1;
  let prevYear = civil.year;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const [currentSpent, prevSpent] = await Promise.all([
    spentInCategoryMonth(workspaceId, categoryId, civil.year, civil.month),
    spentInCategoryMonth(workspaceId, categoryId, prevYear, prevMonth),
  ]);
  if (!currentSpent || !prevSpent) return null;
  return `No mês anterior gastaste ${formatEUR(prevSpent)} nesta categoria (realizado no mês atual: ${formatEUR(currentSpent)}).`;
}

export async function buildAlertExplanationPayload(
  alert: FinancialAlertView,
  workspaceId: string,
): Promise<StructuredExplanationPayload> {
  const evidenceLines = evidenceRecordToLines(alert.evidence);
  const actionLabel = actionLabelFromUrl(alert.actionUrl);
  let topMovements: StructuredExplanationPayload["topMovements"] = [];
  let comparisonNote: string | null = null;
  let dataIncomplete = false;

  if (alert.type === "BUDGET_EXCEEDED" || alert.type === "BUDGET_NEAR_LIMIT") {
    const categoryId = alert.sourceId;
    if (categoryId) {
      topMovements = await topMovementsForBudgetCategory(workspaceId, categoryId, alert.periodStart);
      comparisonNote = await priorBudgetComparison(workspaceId, categoryId, alert.periodStart);
    } else {
      dataIncomplete = true;
    }
  }

  if (topMovements.length === 0 && evidenceLines.length === 0) {
    dataIncomplete = true;
  }

  return {
    kind: "alert",
    subjectType: alert.type,
    severity: alert.severity,
    severityGuide: alertSeverityGuidePt[alert.severity] ?? alert.severity,
    title: alert.title,
    officialSummary: alert.description,
    evidenceLines,
    topMovements,
    comparisonNote,
    availableUserActions: [
      actionLabel ?? "Consultar detalhe",
      "Marcar como visto",
      "Dispensar da minha lista (não resolve a situação)",
    ],
    engineActionLabel: actionLabel,
    dataIncomplete,
  };
}

export function buildInsightExplanationPayload(insight: FinancialInsight): StructuredExplanationPayload {
  return {
    kind: "insight",
    subjectType: insight.type,
    severity: insight.severity,
    severityGuide: insightSeverityGuidePt[insight.severity] ?? insight.severity,
    title: insight.title,
    officialSummary: insight.description,
    evidenceLines: insight.evidence.slice(0, 10),
    topMovements: [],
    comparisonNote: insight.periodLabel ?? null,
    availableUserActions: [
      insight.suggestedAction ? `Sugestão do motor: ${insight.suggestedAction}` : "Rever análises",
      insight.linkHref ? "Abrir página relacionada" : "Consultar movimentos no período",
    ],
    engineActionLabel: insight.suggestedAction ?? null,
    dataIncomplete: Boolean(insight.limitations),
  };
}

export type ExplanationResult = {
  explanation: NaturalLanguageExplanation;
  source: "OLLAMA" | "RULES";
  payload: StructuredExplanationPayload;
};

async function renderExplanation(payload: StructuredExplanationPayload): Promise<ExplanationResult> {
  try {
    const explanation = await explainWithOllama(payload);
    return { explanation, source: "OLLAMA", payload };
  } catch {
    return {
      explanation: buildDeterministicExplanation(payload),
      source: "RULES",
      payload,
    };
  }
}

export async function explainFinancialAlert(
  userId: string,
  workspaceId: string,
  alertId: string,
): Promise<ExplanationResult | null> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) return null;

  const row = await db.financialAlert.findFirst({
    where: { id: alertId, workspaceId },
    include: { userStates: { where: { userId }, take: 1 } },
  });
  if (!row) return null;

  const alert: FinancialAlertView = {
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
    seenAt: row.userStates[0]?.seenAt ?? null,
    dismissedAt: row.userStates[0]?.dismissedAt ?? null,
  };

  const payload = await buildAlertExplanationPayload(alert, workspaceId);
  return renderExplanation(payload);
}

export async function explainFinancialInsightById(
  userId: string,
  workspaceId: string,
  insightId: string,
): Promise<ExplanationResult | null> {
  const overview = await getFinancialInsightsOverview(userId, workspaceId);
  if (!overview) return null;
  const insight = overview.insights.find((item) => item.id === insightId);
  if (!insight) return null;
  const payload = buildInsightExplanationPayload(insight);
  return renderExplanation(payload);
}
