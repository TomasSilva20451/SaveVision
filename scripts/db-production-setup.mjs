#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";
import pg from "pg";
import { validateEnvironment } from "./environment-policy.mjs";
import { installResolvedSecrets, mapDeploymentSecretFiles } from "./secret-files.mjs";

const envPath = resolve(process.cwd(), ".env.production.local");
const loaded = config({ path: envPath, override: false });
if (loaded.error && loaded.error.code !== "ENOENT") {
  throw new Error(`Não foi possível ler ${envPath}`);
}

process.env.FINTWIN_ENV = "production";
mapDeploymentSecretFiles(process.env);
installResolvedSecrets(process.env);
const checked = validateEnvironment(process.env);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL de produção em falta.");
const databaseName = checked.databaseName;

const adminUrl = process.env.FINTWIN_PG_ADMIN_URL ?? "postgresql://fintwin:fintwin@localhost:5433/postgres";
const client = new pg.Client({ connectionString: adminUrl });
await client.connect();
const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
if (exists.rowCount === 0) {
  await client.query(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`);
  console.log(`Base criada: ${databaseName}`);
} else {
  console.log(`Base existente preservada: ${databaseName}`);
}
await client.end();

function run(args) {
  const result = spawnSync("pnpm", args, { env: process.env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["exec", "prisma", "migrate", "deploy"]);
run(["exec", "tsx", "scripts/bootstrap-production-users.ts"]);
