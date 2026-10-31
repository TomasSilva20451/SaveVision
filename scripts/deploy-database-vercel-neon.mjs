#!/usr/bin/env node
/**
 * Migrações na mesma base Neon que o projecto Vercel (savevision).
 * Usa .env.vercel-neon.local — ver .env.vercel-neon.local.example
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { databaseNameFromUrl } from "./environment-policy.mjs";

const envPath = path.resolve(".env.vercel-neon.local");
if (!fs.existsSync(envPath)) {
  console.error(
    "Falta .env.vercel-neon.local — copia .env.vercel-neon.local.example e cola DATABASE_URL do Vercel (Neon).",
  );
  process.exit(1);
}

const loaded = config({ path: envPath, override: true });
if (loaded.error) throw loaded.error;

if (!process.env.DATABASE_URL?.trim()) {
  console.error(".env.vercel-neon.local precisa de DATABASE_URL (postgresql://…?sslmode=require).");
  process.exit(1);
}

for (const suffix of ["_FILE", "_SECRET_FILE"]) {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("DATABASE_URL") && key.endsWith(suffix)) {
      delete process.env[key];
    }
  }
}
delete process.env.FINTWIN_DATABASE_URL_SECRET_FILE;

process.env.FINTWIN_ENV ??= "staging";

const database = databaseNameFromUrl(process.env.DATABASE_URL);
const expected = process.env.FINTWIN_EXPECTED_DATABASE?.trim();
if (expected && expected !== database.name) {
  console.error(
    `FINTWIN_EXPECTED_DATABASE=${expected} não coincide com a base na URL (${database.name}).`,
  );
  process.exit(1);
}
console.log(`[db:vercel-neon] A aplicar migrações em ${database.name}@${database.hostname}.`);

const deploy = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  env: process.env,
  stdio: "inherit",
});
if (deploy.status !== 0) process.exit(deploy.status ?? 1);

const status = spawnSync("pnpm", ["exec", "prisma", "migrate", "status"], {
  env: process.env,
  stdio: "inherit",
});
process.exit(status.status ?? 1);
