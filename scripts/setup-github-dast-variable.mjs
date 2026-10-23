#!/usr/bin/env node
/**
 * Define FINTWIN_DAST_TARGET_URL no GitHub (repository variable) para OWASP ZAP.
 * Uso: node scripts/setup-github-dast-variable.mjs https://staging.example.com
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const url = process.argv[2]?.trim();
if (!url?.startsWith("https://")) {
  console.error("Uso: node scripts/setup-github-dast-variable.mjs https://staging.seu-dominio");
  process.exit(1);
}

const stagingExample = path.resolve(".env.staging.example");
if (fs.existsSync(stagingExample)) {
  const text = fs.readFileSync(stagingExample, "utf8");
  const match = text.match(/^FINTWIN_PUBLIC_URL=(.+)$/m);
  if (match && match[1].trim() !== url && match[1].includes("example")) {
    console.warn(`[dast] Aviso: URL difere de FINTWIN_PUBLIC_URL em .env.staging.example (${match[1].trim()})`);
  }
}

const repoFlag = process.env.GH_REPO?.trim();
const ghArgs = ["variable", "set", "FINTWIN_DAST_TARGET_URL", "--body", url];
if (repoFlag) ghArgs.unshift("-R", repoFlag);

const gh = spawnSync("gh", ghArgs, {
  encoding: "utf8",
  stdio: "inherit",
});
if (gh.status !== 0) {
  console.error(
    "Falha ao definir variable. Manual: GitHub → Settings → Secrets and variables → Actions → Variables → FINTWIN_DAST_TARGET_URL",
  );
  process.exit(gh.status ?? 1);
}
console.log(`[dast] FINTWIN_DAST_TARGET_URL=${url}`);
console.log("[dast] Dispara: gh workflow run security-supply-chain.yml -f (ou workflow_dispatch no UI)");
