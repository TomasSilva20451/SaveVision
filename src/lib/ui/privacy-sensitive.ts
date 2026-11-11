const AMOUNT_PATTERN =
  /[+\-−]?\s?(?:\d{1,3}(?:[.\s\u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+)?\s?[kK]?\s?€/g;

export type AmountRange = { start: number; end: number };

/** Intervalos de montantes em euros dentro de um texto, mesmo no meio de uma frase. */
export function findPrivateAmountRanges(text: string): AmountRange[] {
  const ranges: AmountRange[] = [];
  const pattern = new RegExp(AMOUNT_PATTERN.source, "g");
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    ranges.push({ start, end: start + match[0].length });
  }
  return ranges;
}

/** O texto inteiro é um montante, sem rótulo ao lado. */
export function isPrivateAmount(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return false;
  const leading = text.length - text.trimStart().length;
  const ranges = findPrivateAmountRanges(text);
  return ranges.length === 1 && ranges[0].start === leading && ranges[0].end === leading + trimmed.length;
}
