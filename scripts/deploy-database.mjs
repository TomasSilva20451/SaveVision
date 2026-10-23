#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { validateEnvironment } from "./environment-policy.mjs";
import { installResolvedSecrets } from "./secret-files.mjs";

const environment = process.argv[2];
if (environment !== "staging" && environment !== "production") {
  throw new Error("Uso: node scripts/deploy-database.mjs <staging|production>");
}

const envPath = path.resolve(`.env.${environment}.local`);
if (fs.existsSync(envPath)) {
  const loaded = config({ path: envPath, override: false });
  if (loaded.error) throw loaded.error;
}
process.env.FINTWIN_ENV ??= environment;
process.env.DATABASE_URL_FILE ??= process.env.FINTWIN_DATABASE_URL_SECRET_FILE;
process.env.AUTH_SECRET_FILE ??= process.env.FINTWIN_AUTH_SECRET_FILE;
process.env.FINTWIN_DOCUMENT_ENCRYPTION_KEY_FILE ??= process.env.FINTWIN_DOCUMENT_KEY_SECRET_FILE;
process.env.FINTWIN_AUDIT_SIGNING_KEY_FILE ??= process.env.FINTWIN_AUDIT_KEY_SECRET_FILE;
installResolvedSecrets(process.env);

const checked = validateEnvironment(process.env);
console.log(`[db] A aplicar migrações em ${checked.databaseName}@${checked.databaseHost}.`);

const result = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  env: process.env,
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);

const status = spawnSync("pnpm", ["exec", "prisma", "migrate", "status"], {
  env: process.env,
  stdio: "inherit",
});
process.exit(status.status ?? 1);

