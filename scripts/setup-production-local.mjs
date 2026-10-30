#!/usr/bin/env node
/**
 * Completa, sem substituir valores existentes, a configuração ignorada pelo Git
 * necessária para executar a base live e o Ollama no mesmo Mac.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(".env.production.local");
const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const existingNames = new Set(
  current
    .split(/\r?\n/u)
    .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/u)?.[1])
    .filter(Boolean),
);
const randomBase64 = (bytes) => crypto.randomBytes(bytes).toString("base64");
const wanted = [
  ["FINTWIN_ENV", "production"],
  ["FINTWIN_EXPECTED_DATABASE", "fintwin_live"],
  ["FINTWIN_PRODUCTION_LOCAL", "1"],
  ["FINTWIN_PUBLIC_URL", "http://127.0.0.1:3000"],
  ["FINTWIN_ENFORCE_TLS", "0"],
  ["FINTWIN_DOCUMENT_ENCRYPTION_KEY", randomBase64(32)],
  ["FINTWIN_DOCUMENT_ENCRYPTION_KEY_ID", "production-documents-v1"],
  ["FINTWIN_AUDIT_SIGNING_KEY", randomBase64(48)],
  ["FINTWIN_AUDIT_SIGNING_KEY_ID", "production-audit-v1"],
  ["FINTWIN_REQUIRE_ENCRYPTED_DOCUMENTS", "1"],
  ["FINTWIN_AUDIT_ARCHIVE_REQUIRED", "1"],
  ["FINTWIN_LOCAL_AI_ENABLED", "1"],
];
const missing = wanted.filter(([name]) => !existingNames.has(name));

if (missing.length > 0) {
  const separator = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
  const block = [
    "# Produção local: loopback apenas; gerado por pnpm setup:production:local",
    ...missing.map(([name, value]) => `${name}=${value}`),
    "",
  ].join("\n");
  fs.appendFileSync(envPath, `${separator}${block}`, { mode: 0o600 });
  fs.chmodSync(envPath, 0o600);
}

console.log(
  missing.length > 0
    ? `[ok] Configuração local completada em ${envPath} (${missing.length} valores adicionados).`
    : `[ok] ${envPath} já contém a configuração de produção local.`,
);
