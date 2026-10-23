"use server";

import { requireAuthenticatedUser } from "@/lib/auth/auth";
import type { NaturalLanguageExplanation } from "@/lib/finance/natural-language-explanation";
import {
  explainFinancialAlert,
  explainFinancialInsightById,
} from "@/server/services/financial-alert-explanation";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

export type ExplainActionState =
  | {
      ok: true;
      explanation: NaturalLanguageExplanation;
      source: "OLLAMA" | "RULES";
      dataIncomplete: boolean;
    }
  | { ok: false; error: string }
  | null;

export async function explainFinancialAlertAction(
  _previous: ExplainActionState,
  formData: FormData,
): Promise<ExplainActionState> {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false, error: "Inicia sessão para ver a explicação." };
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return { ok: false, error: "Seleciona um workspace." };

  const alertId = String(formData.get("alertId") ?? "");
  if (!alertId) return { ok: false, error: "Alerta em falta." };

  const result = await explainFinancialAlert(user.id, selected.id, alertId);
  if (!result) return { ok: false, error: "Não foi possível explicar este alerta." };

  return {
    ok: true,
    explanation: result.explanation,
    source: result.source,
    dataIncomplete: result.payload.dataIncomplete,
  };
}

export async function explainFinancialInsightAction(
  _previous: ExplainActionState,
  formData: FormData,
): Promise<ExplainActionState> {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false, error: "Inicia sessão para ver a explicação." };
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return { ok: false, error: "Seleciona um workspace." };

  const insightId = String(formData.get("insightId") ?? "");
  if (!insightId) return { ok: false, error: "Insight em falta." };

  const result = await explainFinancialInsightById(user.id, selected.id, insightId);
  if (!result) return { ok: false, error: "Não foi possível explicar este padrão." };

  return {
    ok: true,
    explanation: result.explanation,
    source: result.source,
    dataIncomplete: result.payload.dataIncomplete,
  };
}
