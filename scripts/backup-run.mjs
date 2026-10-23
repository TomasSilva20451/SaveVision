#!/usr/bin/env node
/**
 * Backup automático: PostgreSQL (pg_dump) + documentos + cifra + off-site + manifesto.
 * Ver docs/BACKUP_RESTORE.md e docs/BUSINESS_CONTINUITY.md.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { opsLog } from "./lib/ops-log.mjs";
import {
  BACKUP_POLICY,
  backupRoot,
  isEncryptionConfigured,
  isOffsiteConfigured,
  retentionDays,
  filesToPrune,
  assertBackupSecurity,
} from "./backup-policy.mjs";
import { installResolvedSecrets } from "./secret-files.mjs";

const root = process.cwd();
for (const envFile of [".env.backup.local", ".env.production.local", ".env"]) {
  const full = path.join(root, envFile);
  if (fs.existsSync(full)) config({ path: full, override: false });
}
installResolvedSecrets(process.env);

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function latestDumpPath() {
  const dir = backupRoot(root);
  const latest = fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".dump"))
    .map((n) => ({ n, m: fs.statSync(path.join(dir, n)).mtimeMs }))
    .sort((a, b) => b.m - a.m)[0];
  if (!latest) throw new Error("pg_dump não produziu ficheiro.");
  return path.join(dir, latest.n);
}

function runPgDump() {
  const script = path.join(root, "scripts/db-backup.sh");
  const result = spawnSync("bash", [script], { cwd: root, env: process.env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return latestDumpPath();
}

function encryptDump(dumpPath) {
  if (!isEncryptionConfigured()) return { path: dumpPath, encrypted: false, cipher: null };
  const encPath = `${dumpPath}.enc`;
  const result = spawnSync(process.execPath, [path.join(root, "scripts/backup-crypto.mjs"), "encrypt", dumpPath, encPath], {
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error("Falha ao cifrar backup com AES-256-GCM autenticado.");
    process.exit(1);
  }
  console.log("[backup] cifra: aes-256-gcm (formato FTBACK01)");
  return { path: encPath, encrypted: true, plaintextRemoved: false, cipher: "aes-256-gcm" };
}

function archiveStorageDirectory(name, stamp) {
  const sourceDir = path.join(root, "storage", name);
  if (!fs.existsSync(sourceDir)) return null;
  const entries = fs.readdirSync(sourceDir);
  if (entries.length === 0) return null;
  const out = path.join(backupRoot(root), `${name}-${stamp}.tar.gz`);
  const result = spawnSync("tar", ["-czf", out, "-C", path.join(root, "storage"), name], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return out;
}

function syncOffsite(files) {
  if (!isOffsiteConfigured()) return { skipped: true, reason: "FINTWIN_BACKUP_OFFSITE_COMMAND em falta" };
  const template = process.env.FINTWIN_BACKUP_OFFSITE_COMMAND.trim();
  for (const file of files) {
    const command = template.replaceAll("$FILE", file).replaceAll("$BASENAME", path.basename(file));
    console.log(`[off-site] ${command}`);
    const result = spawnSync(command, { shell: true, stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  return { skipped: false, files: files.length };
}

function pruneOldBackups() {
  const dir = backupRoot(root);
  if (!fs.existsSync(dir)) return;
  const keep = retentionDays();
  const names = fs.readdirSync(dir);
  for (const name of filesToPrune(names, Date.now(), keep)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isFile()) {
      fs.unlinkSync(full);
      console.log(`[retention] removido ${name}`);
    }
  }
}

function main() {
  assertBackupSecurity();
  fs.mkdirSync(backupRoot(root), { recursive: true });

  console.log("[backup] PostgreSQL…");
  const dumpPath = runPgDump();
  const stampMatch = path.basename(dumpPath).match(/^fintwin-(\d{8}-\d{6})\.dump$/);
  const stamp = stampMatch?.[1] ?? "unknown";
  const encrypted = encryptDump(dumpPath);

  console.log("[backup] Documentos…");
  const docsArchive = archiveStorageDirectory("documents", stamp);
  let docsEnc = null;
  if (docsArchive && isEncryptionConfigured()) {
    docsEnc = encryptDump(docsArchive);
  }

  console.log("[backup] Arquivo de auditoria independente…");
  const auditArchive = archiveStorageDirectory("audit", stamp);
  let auditEnc = null;
  if (auditArchive && isEncryptionConfigured()) auditEnc = encryptDump(auditArchive);

  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    environment: process.env.FINTWIN_ENV ?? "development",
    policy321: BACKUP_POLICY.copies321,
    rpo: {
      minutesWithPitr: BACKUP_POLICY.rpoMinutesWithPitr,
      hoursDumpOnly: BACKUP_POLICY.rpoHoursDumpOnly,
    },
    database: {
      file: path.basename(encrypted.path),
      sha256: sha256File(encrypted.path),
      encrypted: encrypted.encrypted,
      cipher: encrypted.cipher,
      format: "pg_dump-custom",
    },
    documents: docsArchive
      ? {
          file: path.basename(docsEnc?.path ?? docsArchive),
          sha256: sha256File(docsEnc?.path ?? docsArchive),
          encrypted: Boolean(docsEnc?.encrypted),
        }
      : null,
    auditArchive: auditArchive
      ? {
          file: path.basename(auditEnc?.path ?? auditArchive),
          sha256: sha256File(auditEnc?.path ?? auditArchive),
          encrypted: Boolean(auditEnc?.encrypted),
          retentionIndependentFromOperationalDatabase: true,
        }
      : null,
  };

  const manifestPath = path.join(backupRoot(root), `manifest-fintwin-${stamp}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const offsiteFiles = [encrypted.path, manifestPath];
  if (docsEnc?.path) offsiteFiles.push(docsEnc.path);
  else if (docsArchive) offsiteFiles.push(docsArchive);
  if (auditEnc?.path) offsiteFiles.push(auditEnc.path);
  else if (auditArchive) offsiteFiles.push(auditArchive);
  syncOffsite(offsiteFiles);

  if (encrypted.encrypted && process.env.FINTWIN_BACKUP_DELETE_PLAINTEXT === "yes") {
    fs.unlinkSync(dumpPath);
    console.log("[backup] dump em claro removido (FINTWIN_BACKUP_DELETE_PLAINTEXT=yes).");
    for (const archive of [docsArchive, auditArchive]) {
      if (archive && fs.existsSync(archive)) fs.unlinkSync(archive);
    }
  }

  pruneOldBackups();
  opsLog("info", "backup.completed", {
    journey: "backup_job",
    event: "job_success",
    meta: { dump: encrypted.path, manifest: manifestPath },
  });
  console.log(`[backup] concluído: ${encrypted.path}`);
  console.log(`[backup] manifesto: ${manifestPath}`);
}

try {
  main();
} catch (error) {
  opsLog("error", "backup.failed", {
    journey: "backup_job",
    event: "job_failure",
    meta: { message: error instanceof Error ? error.message : String(error) },
  });
  throw error;
}
