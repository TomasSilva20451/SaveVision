/** Headers for Playwright against Vercel Deployment Protection (OIDC or automation bypass). */
export function vercelRemoteExtraHTTPHeaders(): Record<string, string> | undefined {
  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();
  if (oidcToken) {
    return { "x-vercel-trusted-oidc-idp-token": oidcToken };
  }

  const protectionBypass =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ||
    process.env.VERCEL_PROTECTION_BYPASS?.trim();
  if (protectionBypass) {
    return {
      "x-vercel-protection-bypass": protectionBypass,
      "x-vercel-set-bypass-cookie": "true",
    };
  }

  return undefined;
}
