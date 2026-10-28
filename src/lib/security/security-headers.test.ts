import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  createCspNonce,
  securityHeadersForRequest,
  staticDevSecurityHeaders,
} from "@/lib/security/security-headers";

describe("contentSecurityPolicy", () => {
  it("usa nonce e strict-dynamic quando fornecido", () => {
    const csp = contentSecurityPolicy("abc123");
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    const scriptSrc = csp.split(";").find((part) => part.trim().startsWith("script-src"));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  it("fallback dev inclui unsafe-inline sem nonce", () => {
    expect(contentSecurityPolicy()).toContain("'unsafe-inline'");
  });
});

describe("securityHeadersForRequest", () => {
  it("gera nonce único", () => {
    const a = createCspNonce();
    const b = createCspNonce();
    expect(a).not.toBe(b);
    expect(securityHeadersForRequest(a)["Content-Security-Policy"]).toContain(`nonce-${a}`);
  });

  it("staticDevSecurityHeaders alinha com next.config fallback", () => {
    expect(staticDevSecurityHeaders()["X-Frame-Options"]).toBe("DENY");
  });
});
