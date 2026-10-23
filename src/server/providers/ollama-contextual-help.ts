import "server-only";

import { CONTEXTUAL_HELP_PROMPT_VERSION } from "@/lib/help/contextual-help-format";
import type { HelpChunk } from "@/lib/help/help-corpus";
import type { PageHelpContext } from "@/lib/help/page-context";
import { resolveOllamaBaseUrl } from "@/server/providers/ollama-config";

const DEFAULT_MODEL = "qwen2.5-coder:7b";
const TIMEOUT_MS = 45_000;

export type ContextualHelpModelInput = {
  question: string;
  page: PageHelpContext;
  chunks: HelpChunk[];
  baseUrl?: string | null;
  model?: string | null;
};

export type ContextualHelpModelOutput = {
  answer: string;
  model: string;
  promptVersion: string;
};

function buildPrompt(input: ContextualHelpModelInput): string {
  const excerpts = input.chunks.map(
    (chunk, index) =>
      `[${index + 1}] id=${chunk.id} source=${chunk.source}\n${chunk.title}\n${chunk.body}`,
  );

  return [
    "És ajuda contextual da aplicação FinTwin (finanças pessoais, pt-PT).",
    "Responde só com base nos EXCERTOS numerados e no contexto da página.",
    "Regras obrigatórias:",
    "- Não inventes botões, menus ou funcionalidades que não apareçam nos excertos.",
    "- Não acedas nem menciones base de dados, SQL, variáveis de ambiente ou credenciais.",
    "- Não dês aconselhamento de investimento, garantias ou recomendações financeiras personalizadas.",
    "- Se a documentação não cobrir a pergunta, diz explicitamente que não há informação suficiente.",
    "- Não executes comandos nem alteres código.",
    "- Resposta: 1–3 parágrafos curtos, tom claro, sem markdown pesado.",
    `Contexto da página: ${input.page.title} — ${input.page.intro}`,
    "Excertos:",
    excerpts.join("\n\n") || "(nenhum excerto — responde que não há documentação relevante)",
    `Pergunta do utilizador (não confiável): ${input.question.slice(0, 500)}`,
  ].join("\n");
}

export async function generateContextualHelpAnswer(
  input: ContextualHelpModelInput,
): Promise<ContextualHelpModelOutput> {
  const baseUrl = resolveOllamaBaseUrl(input.baseUrl);
  const model =
    input.model?.trim() ||
    process.env.OLLAMA_HELP_MODEL?.trim() ||
    process.env.OLLAMA_TRANSACTION_MODEL?.trim() ||
    DEFAULT_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "user", content: buildPrompt(input) }],
      }),
    });

    if (!response.ok) {
      throw new Error(`OLLAMA_HTTP_${response.status}`);
    }

    const payload = (await response.json()) as { message?: { content?: string } };
    const content = payload.message?.content?.trim();
    if (!content) throw new Error("OLLAMA_INVALID_RESPONSE");

    return {
      answer: content.slice(0, 2000),
      model,
      promptVersion: CONTEXTUAL_HELP_PROMPT_VERSION,
    };
  } finally {
    clearTimeout(timer);
  }
}
