/** Cabeçalhos HTTP (OWASP ASVS V14). CSP ajustada a Next.js App Router. */

export function contentSecurityPolicy(nonce?: string): string {
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
    : "script-src 'self' 'unsafe-inline'";
  const parts = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (process.env.NODE_ENV === "production" || process.env.FINTWIN_ENFORCE_TLS === "1") {
    parts.push("upgrade-insecure-requests");
  }
  return parts.join("; ");
}

export const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()";

export function strictTransportSecurity(): string | null {
  if (process.env.FINTWIN_ENFORCE_TLS === "1" || process.env.NODE_ENV === "production") {
    return "max-age=63072000; includeSubDomains; preload";
  }
  return null;
}
