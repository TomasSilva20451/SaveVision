#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { validateEnvironment } from "./environment-policy.mjs";
import { installResolvedSecrets, mapDeploymentSecretFiles, SECRET_NAMES } from "./secret-files.mjs";

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
mapDeploymentSecretFiles(process.env);
// .env.*.local no Mac costuma ter DATABASE_URL inline *e* caminhos Docker — preferir inline.
for (const name of SECRET_NAMES) {
  if (process.env[name]?.trim()) {
    delete process.env[`${name}_FILE`];
  }
}
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

