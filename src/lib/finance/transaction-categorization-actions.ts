"use server";

import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { normalizeDecimalInput } from "@/lib/finance/money";
import { suggestTransactionCategorization } from "@/server/services/transaction-categorization";
import {
  applyCategorizationReview,
  computeSuggestionsForTransactions,
  listPendingCategorizationReviews,
} from "@/server/services/transaction-categorization-batch";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

const suggestionInputSchema = z.object({
  description: z.string().trim().min(3).max(240),
  amount: z.string().trim().min(1).max(40),
  direction: z.enum(["INCOME", "EXPENSE"]),
});

export type CategorizationActionResult =
  | {
      ok: true;
      suggestion: NonNullable<Awaited<ReturnType<typeof suggestTransactionCategorization>>>;
    }
  | { ok: false; error: string };

export async function suggestTransactionCategorizationAction(input: {
  description: string;
  amount: string;
  direction: "INCOME" | "EXPENSE";
}): Promise<CategorizationActionResult> {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false, error: "Inicia sessão para usar a categorização local." };
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return { ok: false, error: "Seleciona primeiro um workspace." };

  const parsed = suggestionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Indica uma descrição e um montante válidos." };

  try {
    const suggestion = await suggestTransactionCategorization(user.id, selected.id, {
      ...parsed.data,
      amount: normalizeDecimalInput(parsed.data.amount),
    });
    if (!suggestion) return { ok: false, error: "Não tens permissão para categorizar neste workspace." };
    return { ok: true, suggestion };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "MODEL_INVENTED_CATEGORY") {
      return { ok: false, error: "A sugestão foi rejeitada porque não corresponde a uma categoria existente." };
    }
    if (code === "INVALID_AMOUNT" || code === "DESCRIPTION_TOO_SHORT") {
      return { ok: false, error: "Indica uma descrição e um montante válidos." };
    }
    if (code === "OLLAMA_REMOTE_DISABLED") {
      return { ok: false, error: "Por segurança, o FinTwin só permite o Ollama local neste momento." };
    }
    return {
      ok: false,
      error: "O Ollama local não respondeu. Podes escolher a categoria manualmente e guardar na mesma.",
    };
  }
}

export async function listCategorizationReviewsAction() {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false as const, error: "Sessão expirada." };
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return { ok: false as const, error: "Seleciona um workspace." };
  const rows = await listPendingCategorizationReviews(user.id, selected.id);
  if (!rows) return { ok: false as const, error: "Sem permissão." };
  return { ok: true as const, rows };
}

export async function computeCategorizationSuggestionsAction() {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false as const, error: "Sessão expirada." };
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return { ok: false as const, error: "Seleciona um workspace." };
  const result = await computeSuggestionsForTransactions(user.id, selected.id);
  if (!result) return { ok: false as const, error: "Sem permissão." };
  return {
    ok: true as const,
    processed: result.processed,
    candidates: result.candidates,
    localAiActive: result.localAiActive,
    skippedSameCategory: result.skippedSameCategory,
    skippedNoSuggestion: result.skippedNoSuggestion,
    ollamaErrors: result.ollamaErrors,
  };
}

export async function applyCategorizationReviewAction(input: {
  suggestionIds: string[];
  accept: boolean;
}) {
  const user = await requireAuthenticatedUser();
  if (!user) return { ok: false as const, error: "Sessão expirada." };
  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) return { ok: false as const, error: "Seleciona um workspace." };
  const result = await applyCategorizationReview(user.id, selected.id, input);
  if (!result) return { ok: false as const, error: "Sem permissão." };
  return { ok: true as const, updated: result.updated };
}
