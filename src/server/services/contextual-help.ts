import "server-only";

import {
  buildDeterministicHelpAnswer,
  helpAnswerLooksGrounded,
} from "@/lib/help/contextual-help-format";
import { searchHelpCorpus, searchHelpCorpusForPage } from "@/lib/help/help-search";
import {
  explainCurrentPageDeterministic,
  PAGE_EXPLAIN_QUESTION,
} from "@/lib/help/explain-current-page";
import { resolvePageHelpContext } from "@/lib/help/page-context";
import { generateContextualHelpAnswer } from "@/server/providers/ollama-contextual-help";
import {
  getLocalAiSettings,
  isLocalAiActive,
} from "@/server/services/local-ai-settings";

const MAX_QUESTION = 500;

export type ContextualHelpSuccess = {
  ok: true;
  answer: string;
  pageTitle: string;
  model: string;
  promptVersion: string;
  usedFallback: boolean;
  chunkIds: string[];
};

export type ContextualHelpFailure = { ok: false; error: string };

export type ContextualHelpResult = ContextualHelpSuccess | ContextualHelpFailure;

export async function askContextualHelp(
  userId: string,
  question: string,
  pathname: string,
): Promise<ContextualHelpResult> {
  const trimmed = question.trim();
  if (trimmed.length < 4) {
    return { ok: false, error: "Escreve uma pergunta um pouco mais específica." };
  }
  if (trimmed.length > MAX_QUESTION) {
    return { ok: false, error: "A pergunta é demasiado longa." };
  }

  const settings = await getLocalAiSettings(userId);
  if (!isLocalAiActive(settings)) {
    return {
      ok: false,
      error: "A IA local está desactivada. Activa-a em Conta e perfil › IA local.",
    };
  }

  const page = resolvePageHelpContext(pathname);
  const hits = searchHelpCorpus(trimmed, { pathname, limit: 6 });
  const chunks = hits.map((hit) => hit.chunk);

  if (!settings.storePrompts) {
    // v1: não persiste histórico; apenas processamento efémero
  }

  try {
    const generated = await generateContextualHelpAnswer({
      question: trimmed,
      page,
      chunks,
      baseUrl: settings.ollamaBaseUrl,
      model: settings.helpModel,
    });

    if (!helpAnswerLooksGrounded(generated.answer, chunks)) {
      const fallback = buildDeterministicHelpAnswer(trimmed, page, chunks);
      return {
        ok: true,
        answer: fallback,
        pageTitle: page.title,
        model: "deterministic-fallback",
        promptVersion: generated.promptVersion,
        usedFallback: true,
        chunkIds: chunks.map((c) => c.id),
      };
    }

    return {
      ok: true,
      answer: generated.answer,
      pageTitle: page.title,
      model: generated.model,
      promptVersion: generated.promptVersion,
      usedFallback: false,
      chunkIds: chunks.map((c) => c.id),
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "OLLAMA_REMOTE_DISABLED") {
      return {
        ok: false,
        error: "Por segurança, o Ollama tem de estar em localhost (127.0.0.1).",
      };
    }
    const fallback = buildDeterministicHelpAnswer(trimmed, page, chunks);
    return {
      ok: true,
      answer: fallback,
      pageTitle: page.title,
      model: "deterministic-fallback",
      promptVersion: "2026-10-21",
      usedFallback: true,
      chunkIds: chunks.map((c) => c.id),
    };
  }
}

export async function explainCurrentPage(
  userId: string,
  pathname: string,
): Promise<ContextualHelpResult> {
  const settings = await getLocalAiSettings(userId);
  if (!isLocalAiActive(settings)) {
    return {
      ok: false,
      error: "A IA local está desactivada. Activa-a em Conta e perfil › IA local.",
    };
  }

  const page = resolvePageHelpContext(pathname);
  const chunks = searchHelpCorpusForPage(pathname, 3);

  try {
    const generated = await generateContextualHelpAnswer({
      question: PAGE_EXPLAIN_QUESTION,
      page,
      chunks,
      baseUrl: settings.ollamaBaseUrl,
      model: settings.helpModel,
    });
    if (!helpAnswerLooksGrounded(generated.answer, chunks)) {
      return explainCurrentPageDeterministic(pathname);
    }
    return {
      ok: true,
      answer: generated.answer,
      pageTitle: page.title,
      model: generated.model,
      promptVersion: generated.promptVersion,
      usedFallback: false,
      chunkIds: chunks.map((c) => c.id),
    };
  } catch {
    return explainCurrentPageDeterministic(pathname);
  }
}

export { explainCurrentPageDeterministic } from "@/lib/help/explain-current-page";
