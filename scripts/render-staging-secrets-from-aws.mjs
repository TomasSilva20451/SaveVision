#!/usr/bin/env node
/**
 * Lê segredos do AWS Secrets Manager (staging) e escreve ficheiros para mapDeploymentSecretFiles.
 *
 *   pnpm infra:render-staging-secrets --out-dir /etc/fintwin/staging
 *
 * Env: AWS_REGION (default eu-west-1), FINTWIN_TF_ENV=staging
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const outIdx = process.argv.indexOf("--out-dir");
const outDir = outIdx >= 0 ? process.argv[outIdx + 1] : "/etc/fintwin/staging";
const region = process.env.AWS_REGION ?? "eu-west-1";
const env = process.env.FINTWIN_TF_ENV ?? "staging";

const mapping = [
  { secretName: `fintwin/${env}/auth-secret`, file: "auth-secret" },
  { secretName: `fintwin/${env}/document-encryption-key`, file: "document-key" },
  { secretName: `fintwin/${env}/audit-signing-key`, file: "audit-key" },
];

function getSecretString(secretId) {
  const r = spawnSync(
    "aws",
    ["secretsmanager", "get-secret-value", "--secret-id", secretId, "--region", region, "--query", "SecretString", "--output", "text"],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error(`Falha a ler ${secretId}`);
  }
  return r.stdout.trim();
}

function main() {
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  for (const { secretName, file } of mapping) {
    const value = getSecretString(secretName);
    if (value === "REPLACE_VIA_OPS_ROTATION") {
      console.warn(`[skip] ${secretName} ainda placeholder — definir valor antes do deploy`);
      continue;
    }
    const target = path.join(outDir, file);
    fs.writeFileSync(target, `${value}\n`, { mode: 0o600 });
    console.log(`[ok] ${target}`);
  }
  console.log("[info] database-url: compor manualmente a partir de terraform output rds_master_user_secret_arn");
}

main();
