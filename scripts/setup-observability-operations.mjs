#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const examplePath = path.join(root, ".env.observability.example");
const localPath = path.join(root, ".env.observability.local");
const secretsDir = path.join(root, "secrets");
const tokenFile = path.join(secretsDir, "prometheus_metrics_token");

function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function upsertLocal() {
  const example = fs.readFileSync(examplePath, "utf8");
  if (fs.existsSync(localPath)) {
    const current = fs.readFileSync(localPath, "utf8");
    if (/FINTWIN_METRICS_TOKEN=.{20,}/.test(current) && !current.includes("replace-with-long-random-token")) {
      console.log(`[observability] ${localPath} já tem token — mantido.`);
      syncTokenFileFromEnv(current);
      return;
    }
  }
  const token = generateToken();
  const body = example.replace(
    "FINTWIN_METRICS_TOKEN=replace-with-long-random-token",
    `FINTWIN_METRICS_TOKEN=${token}`,
  );
  fs.writeFileSync(localPath, body, { mode: 0o600 });
  fs.mkdirSync(secretsDir, { mode: 0o700, recursive: true });
  fs.writeFileSync(tokenFile, token, { mode: 0o600 });
  console.log(`[observability] Criado ${localPath} e ${tokenFile}`);
  syncProductionMetricsToken(token);
}

function syncTokenFileFromEnv(envText) {
  const match = envText.match(/^FINTWIN_METRICS_TOKEN=(.+)$/m);
  if (!match) return;
  fs.mkdirSync(secretsDir, { mode: 0o700, recursive: true });
  fs.writeFileSync(tokenFile, match[1].trim(), { mode: 0o600 });
}

function syncProductionMetricsToken(token) {
  const prodPath = path.join(root, ".env.production.local");
  if (!fs.existsSync(prodPath)) {
    console.log("[observability] Quando existir .env.production.local, copia FINTWIN_METRICS_TOKEN do .env.observability.local.");
    return;
  }
  let text = fs.readFileSync(prodPath, "utf8");
  if (/^FINTWIN_METRICS_TOKEN=/m.test(text)) {
    text = text.replace(/^FINTWIN_METRICS_TOKEN=.*$/m, `FINTWIN_METRICS_TOKEN=${token}`);
  } else {
    text = `${text.trimEnd()}\nFINTWIN_METRICS_TOKEN=${token}\n`;
  }
  fs.writeFileSync(prodPath, text, { mode: 0o600 });
  console.log("[observability] FINTWIN_METRICS_TOKEN sincronizado em .env.production.local");
}

if (!fs.existsSync(examplePath)) {
  console.error(".env.observability.example em falta.");
  process.exit(1);
}
upsertLocal();
if (fs.existsSync(localPath)) {
  const match = fs.readFileSync(localPath, "utf8").match(/^FINTWIN_METRICS_TOKEN=(.+)$/m);
  if (match) syncProductionMetricsToken(match[1].trim());
}
console.log("[observability] Próximo: pnpm observability:up && pnpm observability:install-cron");
