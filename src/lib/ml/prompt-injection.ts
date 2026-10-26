const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  /ignora\s+(todas?\s+as?\s+)?instru[cç][oõ]es\s+anteriores/i,
  /system\s+prompt/i,
  /revela\s+(o\s+)?prompt/i,
  /developer\s+message/i,
  /executa\s+(este\s+)?comando/i,
  /<\/?(?:system|assistant|developer)>/i,
  /(?:drop|delete|update)\s+(?:table|from|users?|transactions?)/i,
] as const;

export function detectPromptInjection(value: string): { detected: boolean; signals: string[] } {
  const signals = INJECTION_PATTERNS.flatMap((pattern) =>
    pattern.test(value) ? [pattern.source] : [],
  );
  return { detected: signals.length > 0, signals };
}
