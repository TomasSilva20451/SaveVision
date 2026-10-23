/** Envio real por SMTP (quando existir integração). */
export function isSmtpEmailDeliveryConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim());
}

/**
 * Mostrar URLs de verificação na UI (flash, botão no perfil).
 * Sem SMTP o email nunca chega — o link in-app é o único canal até configurar envio.
 */
export function canRevealEmailVerificationLinksInUi(): boolean {
  if (!isSmtpEmailDeliveryConfigured()) return true;
  if (process.env.FINTWIN_EMAIL_DEV_LINKS === "1") return true;
  return process.env.NODE_ENV !== "production" && process.env.FINTWIN_ENV !== "production";
}

export function emailVerificationDevLinkHint(path: string): string {
  return canRevealEmailVerificationLinksInUi() ? ` Abre: ${path}` : "";
}
