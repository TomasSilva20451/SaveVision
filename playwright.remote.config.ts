import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.FINTWIN_E2E_BASE_URL?.replace(/\/$/, "") ??
  "https://savevision.vercel.app";

const protectionBypass =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ||
  process.env.VERCEL_PROTECTION_BYPASS?.trim();
const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();

const extraHTTPHeaders =
  oidcToken != null && oidcToken.length > 0
    ? { "x-vercel-trusted-oidc-idp-token": oidcToken }
    : protectionBypass
      ? {
          "x-vercel-protection-bypass": protectionBypass,
          "x-vercel-set-bypass-cookie": "true",
        }
      : undefined;

/** Smoke remoto apenas — sessão completa: `pnpm test:e2e:remote:session`. */
export default defineConfig({
  testDir: "e2e",
  testIgnore: [/\.test\.ts$/, /auth\.setup\.ts/],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    extraHTTPHeaders,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "remote-smoke",
      testMatch: /00-remote-login-smoke\.spec\.ts/,
    },
  ],
});
