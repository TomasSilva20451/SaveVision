/** Sem pedidos ao servidor durante este intervalo, o JWT expira (janela deslizante). */
export const SESSION_IDLE_SECONDS = 30 * 60;

/** Teto absoluto desde o início de sessão, mesmo com uso contínuo. */
export const SESSION_ABSOLUTE_SECONDS = 12 * 60 * 60;

/** Ao voltar à app depois deste tempo, a página é recarregada para não ficar presa. */
export const SESSION_RESUME_RELOAD_MS = 60 * 1000;

export function absoluteSessionExpired(loginAtSeconds: number, nowSeconds: number) {
  return nowSeconds - loginAtSeconds >= SESSION_ABSOLUTE_SECONDS;
}

const PUBLIC_PREFIXES = ["/login", "/recuperar-conta", "/verificar-email"];

export function isPublicAuthPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
