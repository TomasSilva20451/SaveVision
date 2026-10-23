import { HELP_CORPUS, type HelpChunk } from "@/lib/help/help-corpus";

const STOPWORDS = new Set([
  "a",
  "o",
  "os",
  "as",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "um",
  "uma",
  "como",
  "por",
  "para",
  "que",
  "qual",
  "quais",
  "é",
  "na",
  "no",
  "nos",
  "nas",
  "me",
  "eu",
  "posso",
  "pode",
]);

function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function tokenize(text: string): string[] {
  return normalizeForSearch(text)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

export type HelpSearchHit = {
  chunk: HelpChunk;
  score: number;
};

export function searchHelpCorpus(
  query: string,
  options?: { pathname?: string; limit?: number },
): HelpSearchHit[] {
  const limit = options?.limit ?? 6;
  const pathname = options?.pathname?.split("?")[0]?.replace(/\/$/, "") || "";
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return [];
  }

  const scored: HelpSearchHit[] = [];

  for (const chunk of getCorpus()) {
    const haystack = normalizeForSearch(`${chunk.title} ${chunk.body} ${chunk.tags.join(" ")}`);
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += 1;
      if (chunk.tags.some((tag) => tag.includes(token))) score += 0.5;
    }
    if (pathname && chunk.routes?.includes(pathname)) {
      score += 1.5;
    }
    if (score > 0) {
      scored.push({ chunk, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.chunk.title.localeCompare(b.chunk.title, "pt"));
  return scored.slice(0, limit);
}

/** Permite injeção de corpus em testes. */
let corpusOverride: HelpChunk[] | null = null;

export function setHelpCorpusForTests(chunks: HelpChunk[] | null): void {
  corpusOverride = chunks;
}

function getCorpus(): HelpChunk[] {
  return corpusOverride ?? HELP_CORPUS;
}

/** Excertos para «Explicar esta página» sem pergunta do utilizador. */
export function searchHelpCorpusForPage(pathname: string, limit = 3): HelpChunk[] {
  const normalized = pathname.split("?")[0]?.replace(/\/$/, "") || "/";
  const scored: HelpSearchHit[] = [];
  for (const chunk of getCorpus()) {
    let score = 0;
    if (chunk.routes?.includes(normalized)) score += 10;
    if (chunk.routes?.some((route) => normalized.startsWith(`${route}/`))) score += 5;
    if (score > 0) scored.push({ chunk, score });
  }
  scored.sort((a, b) => b.score - a.score || a.chunk.title.localeCompare(b.chunk.title, "pt"));
  if (scored.length > 0) return scored.slice(0, limit).map((hit) => hit.chunk);
  return getCorpus().slice(0, limit);
}
