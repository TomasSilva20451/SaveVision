import type { HelpChunk } from "@/lib/help/help-corpus";
import type { PageHelpContext } from "@/lib/help/page-context";

export const CONTEXTUAL_HELP_PROMPT_VERSION = "2026-10-21";

export function buildDeterministicHelpAnswer(
  question: string,
  page: PageHelpContext,
  hits: HelpChunk[],
): string {
  const intro = `Estás na área «${page.title}». ${page.intro}`;
  if (hits.length === 0) {
    return `${intro} Não encontrei um artigo específico para «${question.trim().slice(0, 120)}». Consulta o menu ou reformula a pergunta (ex.: conta conjunta, exportar PDF, anular pagamento).`;
  }
  const body = hits
    .slice(0, 2)
    .map((chunk) => `${chunk.title}: ${chunk.body}`)
    .join("\n\n");
  return `${intro}\n\n${body}`;
}

export function helpAnswerLooksGrounded(answer: string, hits: HelpChunk[]): boolean {
  void hits;
  const normalized = answer.toLowerCase();
  const forbidden = [
    "process.env",
    "database_url",
    "password",
    "api key",
    "executar comando",
    "sql ",
    "drop table",
  ];
  if (forbidden.some((needle) => normalized.includes(needle))) {
    return false;
  }
  return answer.length <= 2200;
}
