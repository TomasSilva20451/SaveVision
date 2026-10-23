import { buildDeterministicHelpAnswer } from "@/lib/help/contextual-help-format";
import { searchHelpCorpusForPage } from "@/lib/help/help-search";
import { resolvePageHelpContext } from "@/lib/help/page-context";

export const PAGE_EXPLAIN_QUESTION =
  "Explica o que o utilizador pode fazer nesta página da aplicação FinTwin, em português de Portugal.";

export type ExplainCurrentPageResult = {
  ok: true;
  answer: string;
  pageTitle: string;
  model: string;
  promptVersion: string;
  usedFallback: boolean;
  chunkIds: string[];
};

export function explainCurrentPageDeterministic(pathname: string): ExplainCurrentPageResult {
  const page = resolvePageHelpContext(pathname);
  const chunks = searchHelpCorpusForPage(pathname, 3);
  const answer = buildDeterministicHelpAnswer(PAGE_EXPLAIN_QUESTION, page, chunks);
  return {
    ok: true,
    answer,
    pageTitle: page.title,
    model: "deterministic-fallback",
    promptVersion: "2026-10-21",
    usedFallback: true,
    chunkIds: chunks.map((c) => c.id),
  };
}
