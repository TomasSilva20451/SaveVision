"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { generateMonthlyReportNarrative } from "@/server/services/monthly-report-narrative";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

export type GenerateMonthlyNarrativeResult =
  | { ok: true; narrative: string; model: string; promptVersion: string; periodKey: string }
  | { ok: false; error: string };

export async function generateMonthlyReportNarrativeAction(input: {
  year: number;
  month: number;
}): Promise<GenerateMonthlyNarrativeResult> {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false, error: "Inicia sessão para gerar o resumo." };
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return { ok: false, error: "Seleciona um workspace." };

  if (input.month < 1 || input.month > 12 || input.year < 2000) {
    return { ok: false, error: "Período inválido." };
  }

  try {
    const record = await generateMonthlyReportNarrative(
      user.id,
      selected.id,
      input.year,
      input.month,
    );
    if (!record) {
      return { ok: false, error: "Não tens permissão ou não há dados para este período." };
    }
    revalidatePath("/relatorios");
    return {
      ok: true,
      narrative: record.narrativeText,
      model: record.model,
      promptVersion: record.promptVersion,
      periodKey: record.periodKey,
    };
  } catch {
    return {
      ok: false,
      error: "Não foi possível gerar o resumo. Verifica o Ollama local (gemma3:4b) ou tenta mais tarde.",
    };
  }
}
