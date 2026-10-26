#!/usr/bin/env node
/**
 * Game day: backup/restore drill + checklist failover (evidência JSON).
 * Ver docs/runbooks/game-day-failover.md
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const started = Date.now();
const reportDir = path.join(root, "storage/backups/drill-reports");
fs.mkdirSync(reportDir, { recursive: true });

const steps = [];

function runStep(name, fn) {
  const t0 = Date.now();
  try {
    fn();
    steps.push({ name, ok: true, durationMs: Date.now() - t0 });
  } catch (error) {
    steps.push({
      name,
      ok: false,
      durationMs: Date.now() - t0,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

runStep("backup_restore_drill", () => {
  const r = spawnSync("node", ["scripts/backup-restore-drill.mjs"], { stdio: "inherit", env: process.env });
  if (r.status !== 0) throw new Error("backup-restore-drill falhou");
});

const report = {
  kind: "game_day",
  at: new Date().toISOString(),
  totalDurationMs: Date.now() - started,
  steps,
  rtoTargets: {
    applicationHours: 1,
    postgresHours: 4,
    documentsHours: 4,
  },
  rpoTargets: {
    pitrMinutes: 15,
    dailyDumpHours: 24,
  },
  manualFollowUp: [
    "Failover RDS Multi-AZ (consola AWS) — registar hora início/fim",
    "Rollback imagem: deploy-rollout.mjs rollback + health",
    "Validar audit WORM: pnpm audit:worm:sync --dry-run",
  ],
};

const out = path.join(reportDir, `game-day-${Date.now()}.json`);
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[game-day] Relatório: ${out}`);
