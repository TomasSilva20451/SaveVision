import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

dotenv.config();
const e2eEnvPath = path.join(process.cwd(), ".env.e2e");
if (fs.existsSync(e2eEnvPath)) {
  dotenv.config({ path: e2eEnvPath, override: false });
}

const defaultE2eDatabase =
  "postgresql://fintwin:fintwin@localhost:5433/fintwin_e2e?schema=public";
const configuredE2eDatabase =
  process.env.FINTWIN_E2E_DATABASE_URL ?? defaultE2eDatabase;
const databaseName = (raw: string | undefined) => {
  if (!raw) return "";
  try {
    return new URL(raw).pathname.replace(/^\//, "");
  } catch {
    return "";
  }
};

const expectedE2eDatabase =
  process.env.FINTWIN_EXPECTED_DATABASE || databaseName(configuredE2eDatabase);
if (databaseName(process.env.DATABASE_URL) !== expectedE2eDatabase) {
  process.env.DATABASE_URL = configuredE2eDatabase;
}
process.env.FINTWIN_ENV = "e2e";
process.env.FINTWIN_EXPECTED_DATABASE = expectedE2eDatabase;
process.env.FINTWIN_ALLOW_E2E_CLEANUP ??= "yes";
process.env.FINTWIN_PRIMARY_DATABASE_URL ??=
  "postgresql://fintwin:fintwin@localhost:5433/fintwin?schema=public";

const e2ePort = process.env.FINTWIN_E2E_PORT ?? "3010";
const baseURL = `http://localhost:${e2ePort}`;
const useProductionServer =
  Boolean(process.env.CI) || process.env.FINTWIN_E2E_PRODUCTION === "1";
const e2eDatabaseUrl =
  databaseName(process.env.DATABASE_URL) === expectedE2eDatabase
    ? (process.env.DATABASE_URL ?? configuredE2eDatabase)
    : configuredE2eDatabase;

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "e2e",
  testIgnore: [/\.test\.ts$/, "**/00-remote-login-smoke.spec.ts"],
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
    { name: "setup", testMatch: /auth\.setup\.ts/, timeout: 90_000 },
    {
      name: "auth-session",
      testMatch: /01-auth-session\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testIgnore: [/01-auth-session\.spec\.ts/, /auth\.setup\.ts/, /00-remote-login-smoke\.spec\.ts/],
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/joao.json",
      },
    },
  ],
  webServer: {
    command: useProductionServer
      ? "node scripts/start-standalone.mjs"
      : `pnpm exec next dev --port ${e2ePort}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !useProductionServer,
    timeout: 180_000,
    env: {
      ...process.env,
      DATABASE_URL: e2eDatabaseUrl,
      PORT: e2ePort,
      HOSTNAME: "127.0.0.1",
      // Apenas servidor local de E2E: evita bloqueio durante auth.setup (2 logins).
      // Em produção isLoginRateLimitBypassAllowed() continua false.
      FINTWIN_DISABLE_LOGIN_RATE_LIMIT: "1",
    },
  },
});
