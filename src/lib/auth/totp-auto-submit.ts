const TOTP_LENGTH = 6;

export function normalizeTotpDigits(input: string): string {
  return input.replace(/\D/g, "").slice(0, TOTP_LENGTH);
}

export function isTotpComplete(digits: string): boolean {
  return normalizeTotpDigits(digits).length === TOTP_LENGTH;
}

/**
 * Cada sequência completa de 6 dígitos dispara no máximo uma submissão automática
 * até o utilizador alterar o valor (novo código após erro ou correção parcial).
 */
export function shouldAutoSubmitTotp(digits: string, lastAutoSubmitted: string | null): boolean {
  const normalized = normalizeTotpDigits(digits);
  if (normalized.length !== TOTP_LENGTH) return false;
  if (lastAutoSubmitted === normalized) return false;
  return true;
}

export function canSubmitTotpManually(digits: string, pending: boolean): boolean {
  return isTotpComplete(digits) && !pending;
}
