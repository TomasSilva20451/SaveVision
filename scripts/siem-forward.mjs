#!/usr/bin/env node
/**
 * Envia evento JSON para SIEM (Vector HTTP / Datadog / webhook genérico).
 * Uso: echo '{"event":"test"}' | node scripts/siem-forward.mjs
 * Env: FINTWIN_SIEM_HTTP_ENDPOINT (obrigatório em staging/prod para alertas reais)
 */
const endpoint = process.env.FINTWIN_SIEM_HTTP_ENDPOINT?.trim();
if (!endpoint) {
  console.error("[siem] FINTWIN_SIEM_HTTP_ENDPOINT não definido — noop");
  process.exit(0);
}

let body = "";
if (!process.stdin.isTTY) {
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) body += chunk;
}

const payload = body.trim()
  ? JSON.parse(body)
  : {
      event: "siem.ping",
      service: "fintwin",
      env: process.env.FINTWIN_ENV ?? "development",
      at: new Date().toISOString(),
    };

const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(process.env.FINTWIN_SIEM_TOKEN
      ? { Authorization: `Bearer ${process.env.FINTWIN_SIEM_TOKEN}` }
      : {}),
  },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(15_000),
});

if (!res.ok) {
  console.error(`[siem] HTTP ${res.status}`);
  process.exit(1);
}
console.log("[siem] entregue");
