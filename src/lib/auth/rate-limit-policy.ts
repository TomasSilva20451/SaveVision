/**
 * Rate limit de login: em produção nunca pode ser desativado por flags de teste.
 */
export function isLoginRateLimitBypassAllowed(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.FINTWIN_DISABLE_LOGIN_RATE_LIMIT === "1";
}
