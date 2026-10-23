#!/usr/bin/env node
/**
 * Teste de restauro: backup → BD temporária → comparar contagens → relatório JSON.
 * Destinado a drills trimestrais (CI ou cron local). Ver docs/BUSINESS_CONTINUITY.md.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import {
  assertBackupDrillAllowed,
  backupRoot,
  isAllowedDrillDatabaseName,
} from "./backup-policy.mjs";
import { databaseNameFromUrl } from "./environment-policy.mjs";

const root = process.cwd();
if (fs.existsSync(path.join(root, ".env"))) {
  config({ path: path.join(root, ".env"), override: false });
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runAdminSql(sql) {
  run("bash", [path.join(root, "scripts/backup-pg-exec.sh"), sql]);
}

async function countSnapshot(databaseUrl) {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });
  try {
    const [users, workspaces, transactions] = await Promise.all([
      db.user.count(),
      db.workspace.count(),
      db.transaction.count(),
    ]);
    return { users, workspaces, transactions };
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

function ensureDrillDatabase(drillName) {
  if (!isAllowedDrillDatabaseName(drillName)) {
    throw new Error(`Nome de BD de drill não permitido: ${drillName}`);
  }
  runAdminSql(`DROP DATABASE IF EXISTS ${drillName};`);
  runAdminSql(`CREATE DATABASE ${drillName};`);
}

async function main() {
  assertBackupDrillAllowed();
  const sourceUrl = process.env.FINTWIN_DRILL_SOURCE_URL ?? process.env.DATABASE_URL;
  if (!sourceUrl) throw new Error("DATABASE_URL em falta.");

  const sourceDb = databaseNameFromUrl(sourceUrl).name;
  const drillName = process.env.FINTWIN_DRILL_DATABASE ?? `fintwin_drill_${Date.now()}`;
  const drillUrl = sourceUrl.replace(/\/[^/?]+(\?|$)/, `/${drillName}$1`);

  console.log(`[drill] origem=${sourceDb} destino=${drillName}`);

  const before = await countSnapshot(sourceUrl);

  console.log("[drill] backup…");
  run("bash", [path.join(root, "scripts/db-backup.sh")]);

  const dumpPath = fs
    .readdirSync(backupRoot(root))
    .filter((n) => n.endsWith(".dump") && !n.endsWith(".enc"))
    .map((n) => ({ n, m: fs.statSync(path.join(backupRoot(root), n)).mtimeMs }))
    .sort((a, b) => b.m - a.m)[0]?.n;
  if (!dumpPath) throw new Error("Dump recente não encontrado.");

  ensureDrillDatabase(drillName);

  console.log("[drill] restore…");
  run("bash", [path.join(root, "scripts/db-restore.sh"), path.join(backupRoot(root), dumpPath), drillUrl]);

  const after = await countSnapshot(drillUrl);
  const ok =
    before.users === after.users &&
    before.workspaces === after.workspaces &&
    before.transactions === after.transactions;

  const report = {
    ok,
    at: new Date().toISOString(),
    sourceDatabase: sourceDb,
    drillDatabase: drillName,
    dump: dumpPath,
    counts: { source: before, restored: after },
  };

  fs.mkdirSync(path.join(backupRoot(root), "drill-reports"), { recursive: true });
  const reportPath = path.join(
    backupRoot(root),
    "drill-reports",
    `drill-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[drill] relatório: ${reportPath}`);

  runAdminSql(`DROP DATABASE IF EXISTS ${drillName};`);

  if (!ok) {
    console.error("[drill] FALHOU: contagens divergem.");
    process.exit(1);
  }
  console.log("[drill] OK — contagens coincidem.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
