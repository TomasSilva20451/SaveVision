#!/usr/bin/env node
/** Imprime variáveis para colar no Vercel (Settings → Environment Variables). */
import { spawnSync } from "node:child_process";

function randBase64(bytes) {
  const r = spawnSync("openssl", ["rand", "-base64", String(bytes)], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("openssl rand falhou.");
  return r.stdout.trim();
}

const env = process.argv.includes("--production") ? "production" : "staging";
const db = env === "production" ? "fintwin_live" : "fintwin_staging";

const lines = [
  "# Colar no Vercel → Settings → Environment Variables (Production)",
  `FINTWIN_ENV=${env}`,
  `FINTWIN_EXPECTED_DATABASE=${db}`,
  "DATABASE_URL=postgresql://USER:PASS@HOST/DB?sslmode=require",
  `FINTWIN_PUBLIC_URL=https://SUBSTITUIR.vercel.app`,
  `AUTH_SECRET=${randBase64(48)}`,
  `FINTWIN_DOCUMENT_ENCRYPTION_KEY=${randBase64(32)}`,
  `FINTWIN_DOCUMENT_ENCRYPTION_KEY_ID=${env}-documents-v1`,
  `FINTWIN_AUDIT_SIGNING_KEY=${randBase64(48)}`,
  `FINTWIN_AUDIT_SIGNING_KEY_ID=${env}-audit-v1`,
  "FINTWIN_REQUIRE_ENCRYPTED_DOCUMENTS=1",
  "FINTWIN_ENFORCE_TLS=1",
  "# Opcional Upstash:",
  "# FINTWIN_REDIS_URL=rediss://…",
  "# FINTWIN_RATE_LIMIT_BACKEND=redis",
  "",
  "# vercel.json já define: FINTWIN_CLAMAV_ENABLED=0, FINTWIN_AUDIT_ARCHIVE_REQUIRED=0",
];

console.log(lines.join("\n"));
