/** Base absoluta para links em emails (verificação, recuperação, alertas). */
export function resolvePublicBaseUrl(): string {
  const explicit =
    process.env.AUTH_URL?.trim() ||
    process.env.FINTWIN_PUBLIC_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/$/, "")}`;
  }

  return "http://127.0.0.1:3000";
}

export function absoluteAppUrl(path: string): string {
  const base = resolvePublicBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
