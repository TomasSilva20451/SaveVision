#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { validateEnvironment } from "./environment-policy.mjs";
import { installResolvedSecrets } from "./secret-files.mjs";

const environment = process.argv[2];
if (environment !== "staging" && environment !== "production") {
  throw new Error("Uso: node scripts/deploy-application.mjs <staging|production>");
}

const envPath = path.resolve(`.env.${environment}.local`);
if (fs.existsSync(envPath)) {
  const loaded = config({ path: envPath, override: false });
  if (loaded.error) throw loaded.error;
}

process.env.FINTWIN_ENV = environment;
process.env.DATABASE_URL_FILE ??= process.env.FINTWIN_DATABASE_URL_SECRET_FILE;
process.env.AUTH_SECRET_FILE ??= process.env.FINTWIN_AUTH_SECRET_FILE;
process.env.FINTWIN_DOCUMENT_ENCRYPTION_KEY_FILE ??= process.env.FINTWIN_DOCUMENT_KEY_SECRET_FILE;
process.env.FINTWIN_AUDIT_SIGNING_KEY_FILE ??= process.env.FINTWIN_AUDIT_KEY_SECRET_FILE;
installResolvedSecrets(process.env);
const checked = validateEnvironment(process.env);
const image = process.env.FINTWIN_IMAGE;

if (!image || (!image.includes("@sha256:") && !/:sha-[0-9a-f]{7,}$/i.test(image))) {
  throw new Error(
    "FINTWIN_IMAGE tem de identificar uma imagem imutável por digest ou tag sha-<commit>.",
  );
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(
  `[deploy] ${environment}: ${image} -> ${checked.databaseName}@${checked.databaseHost}`,
);
run("node", ["scripts/deploy-database.mjs", environment]);
const composeArgs = [
  "compose",
  ...(fs.existsSync(envPath) ? ["--env-file", envPath] : []),
  "-f",
  "compose.deploy.yml",
  "--profile",
  environment,
  "up",
  "-d",
  "--wait",
  `app-${environment}`,
];
run("docker", composeArgs);

console.log(`[deploy] ${environment} saudável e a usar a imagem ${image}.`);
