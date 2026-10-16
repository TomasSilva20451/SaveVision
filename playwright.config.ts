import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

const e2ePort = process.env.FINTWIN_E2E_PORT ?? "3010";
const baseURL = `http://localhost:${e2ePort}`;

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "e2e",
  testIgnore: [/\.test\.ts$/],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "auth-session",
      testMatch: /01-auth-session\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testIgnore: [/01-auth-session\.spec\.ts/, /auth\.setup\.ts/],
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/joao.json",
      },
    },
  ],
  webServer: {
    command: process.env.CI
      ? `pnpm exec next start --port ${e2ePort}`
      : `pnpm exec next dev --port ${e2ePort}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      // Apenas servidor local de E2E: evita bloqueio durante auth.setup (2 logins).
      // Em produção isLoginRateLimitBypassAllowed() continua false.
      FINTWIN_DISABLE_LOGIN_RATE_LIMIT: "1",
    },
  },
});
