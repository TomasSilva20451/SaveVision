const BANK_NOISE = new Set([
  "MB",
  "MBWAY",
  "MULTIBANCO",
  "POS",
  "TPA",
  "VISA",
  "MC",
  "MASTERCARD",
  "PAG",
  "PAGAMENTO",
  "COMPRA",
  "DEB",
  "CRED",
  "TRF",
  "TRANSFERENCIA",
  "TRANSFERÊNCIA",
]);

export type NormalizedMerchant = {
  displayLabel: string;
  searchPattern: string;
};

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Padrão para matching de regras e duplicados (uppercase, sem acentos). */
export function normalizeMerchantSearchPattern(value: string): string {
  const upper = stripDiacritics(value)
    .toLocaleUpperCase("pt-PT")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = upper
    .split(" ")
    .filter((token) => token.length > 1 && !BANK_NOISE.has(token));

  return tokens.join(" ").slice(0, 120);
}

/** Etiqueta legível para UI e descrições. */
export function normalizeMerchantDisplayLabel(value: string): string {
  const pattern = normalizeMerchantSearchPattern(value);
  if (!pattern) return value.trim().slice(0, 100) || "Comerciante";
  return pattern
    .toLocaleLowerCase("pt-PT")
    .replace(/\b\p{L}/gu, (char) => char.toLocaleUpperCase("pt-PT"))
    .slice(0, 100);
}

export function normalizeMerchant(value: string): NormalizedMerchant {
  const trimmed = value.trim().slice(0, 240);
  return {
    displayLabel: normalizeMerchantDisplayLabel(trimmed),
    searchPattern: normalizeMerchantSearchPattern(trimmed),
  };
}

/** @deprecated use normalizeMerchantSearchPattern — compat categorização */
export function normalizeCategorizationPattern(value: string): string {
  return normalizeMerchantSearchPattern(value);
}
