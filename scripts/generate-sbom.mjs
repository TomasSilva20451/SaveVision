#!/usr/bin/env node
/**
 * Gera SBOM CycloneDX por versão (commit/tag) em dist/sbom/bom.json
 * Usa cdxgen (pnpm-lock.yaml); cyclonedx-npm falha com layouts pnpm.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outDir = path.join(root, "dist", "sbom");
fs.mkdirSync(outDir, { recursive: true });

const version =
  process.env.GITHUB_SHA?.slice(0, 12) ??
  process.env.FINTWIN_BUILD_SHA?.slice(0, 12) ??
  "local";

const outFile = path.join(outDir, "bom.json");

const result = spawnSync(
  "pnpm",
  [
    "exec",
    "cdxgen",
    "-t",
    "pnpm",
    "--required-only",
    "--no-babel",
    "-o",
    outFile,
  ],
  { cwd: root, stdio: "inherit", env: process.env, timeout: 300_000 },
);

if (result.status !== 0) {
  console.error("SBOM falhou. Instala: pnpm add -D @cyclonedx/cdxgen");
  process.exit(result.status ?? 1);
}

const meta = {
  generatedAt: new Date().toISOString(),
  version,
  app: process.env.APP_NAME ?? "FinTwin",
};
fs.writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(meta, null, 2)}\n`);
console.log(`[sbom] dist/sbom/bom.json (${version})`);
