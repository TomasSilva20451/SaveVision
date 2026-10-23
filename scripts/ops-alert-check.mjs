#!/usr/bin/env node
/**
 * Verifica health + limiares simples e envia alerta operacional (webhook).
 * Uso: FINTWIN_PUBLIC_URL=https://... FINTWIN_OPS_WEBHOOK_URL=https://... node scripts/ops-alert-check.mjs
 */
import { opsLog } from "./lib/ops-log.mjs";

const base = process.env.FINTWIN_PUBLIC_URL ?? "http://127.0.0.1:3000";
const webhook = process.env.FINTWIN_OPS_WEBHOOK_URL?.trim();

async function fetchJson(path) {
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15_000) });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function breaches(health, metricsText) {
  const issues = [];
  if (health.status !== 200 || health.body.status !== "ok") {
    issues.push(`health=${health.body.status ?? health.status}`);
  }
  const loginFailures = Number(metricsText.match(/fintwin_login_attempts_total\{result="failure"}\s+(\d+)/)?.[1] ?? 0);
  const http5xx = Number(metricsText.match(/fintwin_http_errors_total\{route="([^"]+)"\}\s+(\d+)/g)?.length ?? 0);
  if (loginFailures > 100) issues.push(`login_failures=${loginFailures}`);
  if (http5xx > 0) issues.push(`http_error_series=${http5xx}`);
  return issues;
}

const health = await fetchJson("/api/health");
const metricsRes = await fetch(`${base}/api/metrics`, {
  headers: process.env.FINTWIN_METRICS_TOKEN
    ? { Authorization: `Bearer ${process.env.FINTWIN_METRICS_TOKEN}` }
    : {},
});
const metricsText = await metricsRes.text();
const issues = breaches(health, metricsText);

if (issues.length === 0) {
  opsLog("info", "ops.alert_check_ok", { event: "ops_alert_check", meta: { base } });
  process.exit(0);
}

const payload = {
  text: `FinTwin alerta operacional: ${issues.join(", ")}`,
  severity: health.body.status === "critical" ? "P1" : "P2",
  health: health.body,
  at: new Date().toISOString(),
};

opsLog("warn", "ops.alert_triggered", { event: "ops_alert_check", meta: { issues } });

if (webhook) {
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    opsLog("error", "ops.webhook_failed", { meta: { status: res.status } });
    process.exit(1);
  }
}

process.exit(issues.length > 0 ? 2 : 0);
