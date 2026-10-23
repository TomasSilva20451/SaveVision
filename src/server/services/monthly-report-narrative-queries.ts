import { requireWorkspaceEditor } from "@/lib/auth/workspace-access";
import type { MonthlyReportFacts } from "@/lib/finance/monthly-report-summary";
import { db } from "@/lib/db";
import { isPrismaMissingTableError } from "@/lib/db/prisma-missing-table";

export type MonthlyReportNarrativeRecord = {
  id: string;
  periodKey: string;
  narrativeText: string;
  model: string;
  promptVersion: string;
  sourceFacts: MonthlyReportFacts;
  generatedAt: Date;
};

export async function getLatestMonthlyReportNarrative(
  userId: string,
  workspaceId: string,
  periodKey: string,
): Promise<MonthlyReportNarrativeRecord | null> {
  const membership = await requireWorkspaceEditor(userId, workspaceId);
  if (!membership) return null;

  let row;
  try {
    row = await db.monthlyReportNarrative.findFirst({
      where: { workspaceId, periodKey },
      orderBy: { generatedAt: "desc" },
    });
  } catch (error) {
    if (isPrismaMissingTableError(error)) return null;
    throw error;
  }
  if (!row) return null;

  return {
    id: row.id,
    periodKey: row.periodKey,
    narrativeText: row.narrativeText,
    model: row.model,
    promptVersion: row.promptVersion,
    sourceFacts: row.sourceFactsJson as MonthlyReportFacts,
    generatedAt: row.generatedAt,
  };
}
