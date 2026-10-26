#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import net from "node:net";

function portIsAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    // Sem host explícito: deteta ocupação tanto em IPv4 como em IPv6/localhost.
    server.listen({ port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findE2ePort() {
  if (process.env.FINTWIN_E2E_PORT) return process.env.FINTWIN_E2E_PORT;
  for (let port = 3010; port <= 3099; port += 1) {
    if (await portIsAvailable(port)) return String(port);
  }
  throw new Error("Não foi encontrada uma porta E2E livre entre 3010 e 3099.");
}

const verificationDatabaseName = `fintwin_verify_${process.pid}_${Date.now()}_e2e`;
const databaseUrl =
  process.env.FINTWIN_E2E_DATABASE_URL ??
  `postgresql://fintwin:fintwin@localhost:5433/${verificationDatabaseName}?schema=public`;
const expectedDatabaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
const primaryDatabaseUrl =
  process.env.FINTWIN_PRIMARY_DATABASE_URL ??
  "postgresql://fintwin:fintwin@localhost:5433/fintwin?schema=public";
const e2ePort = await findE2ePort();

const verificationEnv = {
  ...process.env,
  FINTWIN_ENV: "e2e",
  FINTWIN_SEED_PROFILE: "e2e",
  FINTWIN_ALLOW_E2E_CLEANUP: "yes",
  FINTWIN_E2E_DATABASE_URL: databaseUrl,
  FINTWIN_EXPECTED_DATABASE: expectedDatabaseName,
  FINTWIN_PRIMARY_DATABASE_URL: primaryDatabaseUrl,
  FINTWIN_E2E_PORT: e2ePort,
  DATABASE_URL: databaseUrl,
  AUTH_SECRET:
    process.env.AUTH_SECRET ?? "ci-only-auth-secret-with-at-least-32-characters",
  FINTWIN_ML_EVAL_PERSIST: "1",
  NEXT_TELEMETRY_DISABLED: "1",
};

console.log(`[verify] Servidor E2E reservado na porta ${e2ePort}.`);

function run(command, args) {
  console.log(`\n==> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: verificationEnv,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.FINTWIN_SKIP_DOCKER !== "1") {
  run("docker", ["compose", "up", "-d", "--wait", "postgres"]);
}

run("node", ["scripts/validate-environment.mjs"]);
run("pnpm", ["db:e2e"]);
run("pnpm", ["lint"]);
run("pnpm", ["typecheck"]);
run("pnpm", ["test:config"]);
run("pnpm", ["ml:eval"]);
run("pnpm", ["test"]);
run("pnpm", ["build"]);
run("pnpm", ["test:e2e:strict"]);

console.log("\nVerificação reprodutível concluída: todos os portões passaram.");

