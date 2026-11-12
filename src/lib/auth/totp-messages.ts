export const MFA_TOTP_INVALID_MESSAGE =
  "Código inválido ou expirado. Introduz um novo código.";

export const MFA_TOTP_NETWORK_MESSAGE = "Não foi possível verificar o código. Tenta novamente.";

export function isMfaTotpInvalidMessage(message: string | null | undefined): boolean {
  return message === MFA_TOTP_INVALID_MESSAGE;
}

export function isMfaTotpNetworkMessage(message: string | null | undefined): boolean {
  return message === MFA_TOTP_NETWORK_MESSAGE;
}
