/** Cabeçalhos HTTP (OWASP ASVS V14). CSP ajustada a Next.js App Router. */

export const CSP_NONCE_HEADER = "x-nonce";

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

export function createCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/** Cabeçalhos de segurança por pedido (CSP com nonce — R8). */
export function securityHeadersForRequest(nonce: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": contentSecurityPolicy(nonce),
    "Permissions-Policy": PERMISSIONS_POLICY,
  };
  const hsts = strictTransportSecurity();
  if (hsts) headers["Strict-Transport-Security"] = hsts;
  return headers;
}

/** Dev/local sem proxy: CSP permissiva para hot reload. */
export function staticDevSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": contentSecurityPolicy(),
    "Permissions-Policy": PERMISSIONS_POLICY,
  };
}
