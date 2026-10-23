import "server-only";

import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  FINANCIAL_ASSISTANT_INTENTS,
  validateAssistantIntent,
  financialAssistantRawOutputSchema,
} from "@/lib/finance/financial-assistant-intents";
import type { FinancialAssistantProvider } from "@/server/providers/contracts";
import { ollamaFinancialAssistantProvider } from "@/server/providers/ollama-financial-assistant";
import { formatAssistantAnswer } from "@/lib/finance/financial-assistant-format";
import { runAssistantTool } from "@/server/services/financial-assistant-tools";
import { getLocalAiSettings, isLocalAiActive } from "@/server/services/local-ai-settings";

const CLARIFICATION_CONFIDENCE = 0.55;
const MAX_QUESTION_LEN = 500;

export type FinancialAssistantSuccess = {
  ok: true;
  answer: string;
  evidence: string[];
  links: { label: string; href: string }[];
  intent: string;
  confidence: number;
  dataIncomplete?: boolean;
  clarification?: string | null;
};

export type FinancialAssistantFailure = { ok: false; error: string };

export type FinancialAssistantResult = FinancialAssistantSuccess | FinancialAssistantFailure;

export async function askFinancialAssistant(
  userId: string,
  workspaceId: string,
  question: string,
  provider: FinancialAssistantProvider = ollamaFinancialAssistantProvider,
): Promise<FinancialAssistantResult> {
  const membership = await requireWorkspaceAccess(userId, workspaceId);
  if (!membership) {
    return { ok: false, error: "Não tens acesso a este workspace." };
  }

  const aiSettings = await getLocalAiSettings(userId);
  if (!isLocalAiActive(aiSettings)) {
    return {
      ok: false,
      error: "A IA local está desactivada. Activa-a em Conta e perfil › IA local.",
    };
  }

  const trimmed = question.trim();
  if (trimmed.length < 4) {
    return { ok: false, error: "Escreve uma pergunta um pouco mais específica." };
  }
  if (trimmed.length > MAX_QUESTION_LEN) {
    return { ok: false, error: "A pergunta é demasiado longa." };
  }

  let raw;
  try {
    raw = financialAssistantRawOutputSchema.parse(
      await provider.parseIntent({
        question: trimmed,
        allowedIntents: FINANCIAL_ASSISTANT_INTENTS,
      }),
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "OLLAMA_REMOTE_DISABLED") {
      return {
        ok: false,
        error: "Por segurança, o assistente só funciona com Ollama local (127.0.0.1).",
      };
    }
    return {
      ok: false,
      error: "O modelo local não respondeu. Verifica se o Ollama está a correr e o modelo está instalado.",
    };
  }

  if (raw.clarification && raw.confidence < CLARIFICATION_CONFIDENCE) {
    return {
      ok: true,
      answer: raw.clarification,
      evidence: [],
      links: [{ label: "Assistente", href: "/assistente" }],
      intent: raw.intent,
      confidence: raw.confidence,
      clarification: raw.clarification,
    };
  }

  const validated = validateAssistantIntent(raw);
  if (!validated) {
    return {
      ok: false,
      error:
        raw.clarification ??
        "Não consegui interpretar a pergunta com segurança. Indica categoria, período ou montante.",
    };
  }

  try {
    const tool = await runAssistantTool(userId, workspaceId, validated);
    const answer = raw.clarification?.trim()
      ? `${formatAssistantAnswer(validated, tool)} ${raw.clarification}`
      : formatAssistantAnswer(validated, tool);

    return {
      ok: true,
      answer,
      evidence: tool.evidence,
      links: tool.links,
      intent: validated.intent,
      confidence: raw.confidence,
      dataIncomplete: tool.dataIncomplete,
      clarification: raw.clarification,
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "UNKNOWN_CATEGORY") {
      return {
        ok: false,
        error: "Não encontrei essa categoria neste workspace. Escolhe uma categoria existente.",
      };
    }
    if (code === "NO_ACCOUNTS") {
      return { ok: false, error: "Ainda não há contas ativas neste workspace." };
    }
    return { ok: false, error: "Não foi possível calcular a resposta com os dados atuais." };
  }
}
