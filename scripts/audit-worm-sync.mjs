#!/usr/bin/env node
/**
 * Sincroniza arquivo JSONL de auditoria para bucket WORM (AWS CLI).
 *
 * Env: FINTWIN_AUDIT_WORM_BUCKET, FINTWIN_ENV, FINTWIN_AUDIT_ARCHIVE_DIR (opcional)
 *   pnpm audit:worm:sync [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const dryRun = process.argv.includes("--dry-run");
const env = process.env.FINTWIN_ENV?.trim() || "development";
const bucket = process.env.FINTWIN_AUDIT_WORM_BUCKET?.trim();
const archiveDir = process.env.FINTWIN_AUDIT_ARCHIVE_DIR?.trim()
  || path.join(process.cwd(), "storage", "audit", env);
const file = path.join(archiveDir, "audit-events.jsonl");

if (!bucket) {
  console.error("Define FINTWIN_AUDIT_WORM_BUCKET (terraform output audit_worm_bucket)");
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`Arquivo inexistente: ${file}`);
  process.exit(1);
}

const key = `${env}/audit-events/${new Date().toISOString().slice(0, 10)}/audit-events.jsonl`;
const dest = `s3://${bucket}/${key}`;

const args = ["s3", "cp", file, dest, "--sse", "aws:kms"];
if (dryRun) args.push("--dryrun");

console.log(`[worm] ${dryRun ? "dry-run " : ""}${file} → ${dest}`);
const r = spawnSync("aws", args, { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
