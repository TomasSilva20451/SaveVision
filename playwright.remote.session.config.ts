import { defineConfig, devices } from "@playwright/test";
import { vercelRemoteExtraHTTPHeaders } from "./src/lib/e2e/vercel-remote-headers";

const baseURL =
  process.env.FINTWIN_E2E_BASE_URL?.replace(/\/$/, "") ??
  "https://savevision.vercel.app";

const extraHTTPHeaders = vercelRemoteExtraHTTPHeaders();

const remoteEmail = process.env.FINTWIN_REMOTE_E2E_EMAIL?.trim() ?? "";
const remotePassword = process.env.FINTWIN_REMOTE_E2E_PASSWORD?.trim() ?? "";
const hasRemoteCredentials = Boolean(remoteEmail && remotePassword);

if (!hasRemoteCredentials) {
  throw new Error(
    "Sessão remota exige FINTWIN_REMOTE_E2E_EMAIL e FINTWIN_REMOTE_E2E_PASSWORD " +
      "(conta criada com pnpm db:production:setup na Neon). " +
      "Smoke: pnpm test:e2e:remote",
  );
}

if (remoteEmail.endsWith("@example.local")) {
  throw new Error(
    "João/Maria (user1@example.local) só existem em local com pnpm db:seed:e2e ou db:demo-ui. " +
      "No Vercel/Neon usa o email e palavra-passe do pnpm db:production:setup (Tomás/Telmo).",
  );
}

export default defineConfig({
  testDir: "e2e",
  testIgnore: [/\.test\.ts$/, /auth\.setup\.ts/],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
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
    {
      name: "auth-session-remote",
      testMatch: /01-auth-session\.spec\.ts/,
      dependencies: ["remote-smoke"],
    },
  ],
});
