import { defineConfig, devices } from "@playwright/test";
import { vercelRemoteExtraHTTPHeaders } from "./e2e/helpers/vercel-remote-headers";

const baseURL =
  process.env.FINTWIN_E2E_BASE_URL?.replace(/\/$/, "") ??
  "https://savevision.vercel.app";

const extraHTTPHeaders = vercelRemoteExtraHTTPHeaders();

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
    ...(extraHTTPHeaders ? { extraHTTPHeaders } : {}),
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
