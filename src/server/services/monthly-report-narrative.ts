import { requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import {
  MONTHLY_REPORT_PROMPT_VERSION,
  buildDeterministicMonthlyNarrative,
  narrativeMatchesFacts,
} from "@/lib/finance/monthly-report-summary";
import { db } from "@/lib/db";
import { narrateMonthlyReportWithOllama } from "@/server/providers/ollama-monthly-report-narrative";
import { buildMonthlyReportFacts } from "@/server/services/monthly-report-summary-builder";
import type { MonthlyReportNarrativeRecord } from "@/server/services/monthly-report-narrative-queries";

export type { MonthlyReportNarrativeRecord } from "@/server/services/monthly-report-narrative-queries";
export { getLatestMonthlyReportNarrative } from "@/server/services/monthly-report-narrative-queries";

export async function generateMonthlyReportNarrative(
  userId: string,
  workspaceId: string,
  year: number,
  month: number,
): Promise<MonthlyReportNarrativeRecord | null> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  const facts = await buildMonthlyReportFacts(userId, workspaceId, year, month);
  if (!facts) return null;

  let model = "deterministic";
  let narrative = buildDeterministicMonthlyNarrative(facts);

  try {
    const ollama = await narrateMonthlyReportWithOllama(facts);
    if (narrativeMatchesFacts(ollama.narrative, facts)) {
      narrative = ollama.narrative;
      model = ollama.model;
    }
  } catch {
    // Mantém fallback determinístico.
  }

  const row = await db.monthlyReportNarrative.create({
    data: {
      workspaceId,
      periodKey: facts.period,
      promptVersion: MONTHLY_REPORT_PROMPT_VERSION,
      model,
      sourceFactsJson: facts,
      narrativeText: narrative,
      generatedById: userId,
    },
  });

  return {
    id: row.id,
    periodKey: row.periodKey,
    narrativeText: row.narrativeText,
    model: row.model,
    promptVersion: row.promptVersion,
    sourceFacts: facts,
    generatedAt: row.generatedAt,
  };
}
