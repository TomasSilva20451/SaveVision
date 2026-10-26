#!/usr/bin/env node
/**
 * Compara report_json.json do OWASP ZAP com security/baseline/dast-high-alerts.json.
 * Falha se existirem alertas High novos (fora da baseline).
 *
 * Uso:
 *   node scripts/dast-compare-baseline.mjs [--report path] [--update-baseline]
 */
import fs from "node:fs";
import path from "node:path";

const reportPath = process.argv.includes("--report")
  ? process.argv[process.argv.indexOf("--report") + 1]
  : "report_json.json";
const updateBaseline = process.argv.includes("--update-baseline");
const baselinePath = path.resolve("security/baseline/dast-high-alerts.json");

function highKeysFromZapReport(json) {
  const keys = new Set();
  const sites = json.site ?? [];
  for (const site of sites) {
    const alerts = site.alerts ?? [];
    for (const alert of alerts) {
      const risk = String(alert.riskcode ?? alert.risk ?? "");
      const riskLabel = String(alert.riskdesc ?? alert.risk ?? "").toLowerCase();
      const isHigh = risk === "3" || riskLabel.includes("high");
      if (!isHigh) continue;
      const plugin = alert.pluginid ?? alert.alert ?? "unknown";
      const name = alert.alert ?? alert.name ?? "alert";
      const uri = alert.uri ?? alert.url ?? site["@name"] ?? "";
      keys.add(`${plugin}|${name}|${uri}`);
    }
  }
  return [...keys].sort();
}

function loadBaseline() {
  const raw = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  return new Set(raw.highAlertKeys ?? []);
}

function main() {
  if (!fs.existsSync(reportPath)) {
    console.error(`[dast] Relatório não encontrado: ${reportPath}`);
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const current = highKeysFromZapReport(report);
  const baseline = loadBaseline();

  const novel = current.filter((key) => !baseline.has(key));
  const resolved = [...baseline].filter((key) => !current.includes(key));

  console.log(JSON.stringify({ highCount: current.length, novelCount: novel.length, resolvedCount: resolved.length }, null, 2));

  if (updateBaseline) {
    const next = {
      ...JSON.parse(fs.readFileSync(baselinePath, "utf8")),
      highAlertKeys: current,
      updatedAt: new Date().toISOString(),
      updatedBy: "dast-compare-baseline --update-baseline",
    };
    fs.writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
    console.log("[dast] Baseline actualizada.");
    process.exit(0);
  }

  if (novel.length > 0) {
    console.error("[dast] Novos alertas High (fora da baseline):");
    for (const key of novel) console.error(`  - ${key}`);
    console.error("[dast] Aceitar conscientemente: node scripts/dast-compare-baseline.mjs --update-baseline");
    process.exit(1);
  }

  console.log("[dast] Sem High novos face à baseline.");
}

main();
