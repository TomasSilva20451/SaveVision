#!/usr/bin/env node
/**
 * Lê .env.smtp.local (gitignored) e define SMTP_* + confirma FINTWIN_PUBLIC_URL na Vercel (Production).
 * Template: .env.smtp.local.example
 *
 * Uso: pnpm vercel:smtp:push
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const envPath = path.join(root, ".env.smtp.local");
const examplePath = path.join(root, ".env.smtp.local.example");

const KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "SMTP_SECURE",
  "APP_NAME",
];

function parseEnvFile(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function addEnv(key, value, environment) {
  const child = spawnSync(
    "vercel",
    ["env", "add", key, environment, "--force"],
    { input: value, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] },
  );
  if (child.status !== 0) {
    throw new Error(`vercel env add ${key} (${environment}) falhou.`);
  }
}

if (!fs.existsSync(envPath)) {
  console.error(
    `[smtp] Cria ${envPath} a partir de ${path.basename(examplePath)} com credenciais do teu domínio.`,
  );
  console.error("[smtp] Ver docs/VERCEL_SMTP_CHECKLIST.md (DNS SPF/DKIM).");
  process.exit(1);
}

const parsed = parseEnvFile(fs.readFileSync(envPath, "utf8"));
const missing = KEYS.filter((k) => k !== "APP_NAME" && k !== "SMTP_SECURE" && !parsed[k]?.trim());
if (missing.length > 0) {
  console.error(`[smtp] Em falta em .env.smtp.local: ${missing.join(", ")}`);
  process.exit(1);
}

for (const environment of ["production", "preview"]) {
  for (const key of KEYS) {
    const value = parsed[key]?.trim();
    if (!value) continue;
    console.log(`[smtp] ${environment}: ${key}`);
    addEnv(key, value, environment);
  }
}

console.log("[smtp] Concluído. Redeploy: vercel --prod");
