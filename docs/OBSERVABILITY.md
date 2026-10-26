# Observabilidade

## Logs estruturados (centralização)

Todos os eventos relevantes em **JSON linha-a-linha** no stdout:

- Servidor Node: `src/lib/observability/logger.ts` (`log.info`, `log.error`, …)
- Edge middleware: `http_access` em `src/middleware.ts`
- Jobs/cron: `scripts/lib/ops-log.mjs` (ex.: backup)

Campos comuns: `ts`, `level`, `msg`, `service`, `env`, `requestId`, `traceId`, `journey`, `event`, `meta`.

**Centralizar:** `pnpm observability:up` (Loki + Vector em `compose.observability.yml`). Alternativa Elastic: `infra/elastic/filebeat.docker.yml.example`.

## Métricas

| Métrica | Labels | Origem |
|---------|--------|--------|
| `fintwin_login_attempts_total` | `result` | Auth credentials |
| `fintwin_login_duration_seconds` | `result` | Auth |
| `fintwin_http_requests_total` | `route`, `status` | API (`observeApiRoute`) |
| `fintwin_http_errors_total` | `route` | Erros 5xx + `onRequestError` |
| `fintwin_transactions_total` | `kind` | Receitas/despesas |
| `fintwin_jobs_total` | `job`, `result` | Scripts (backup) |
| `fintwin_process_uptime_seconds` | — | Processo Node |

**Scrape Prometheus:** `GET /api/metrics` (texto) ou `?format=json`.  
Produção: definir `FINTWIN_METRICS_TOKEN` e header `Authorization: Bearer …`.

## OpenTelemetry

Activar com:

```env
FINTWIN_OTEL_ENABLED=1
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
OTEL_SERVICE_NAME=fintwin
```

`src/instrumentation.ts` regista o SDK (traces + metrics OTLP HTTP). Spans manuais: `withSpan()` em login e extensível a outros fluxos. Propagação W3C: headers `traceparent` / `x-trace-id` no middleware.

## Arranque rápido (host local)

```bash
pnpm observability:setup          # .env.observability.local + secrets/prometheus_metrics_token
pnpm observability:up             # Loki :3100, Prometheus :9090, Vector, OTEL :4318
pnpm observability:install-cron  # ops:alert-check de hora a hora
```

Copiar `FINTWIN_METRICS_TOKEN` para `.env.production.local` antes de `pnpm start:production` (Prometheus usa bearer no scrape).

## Alertas operacionais

```bash
pnpm ops:alert-check
```

Verifica `/api/health` e limiares simples nas métricas; envia JSON ao webhook se `FINTWIN_OPS_WEBHOOK_URL` estiver definido.

Logs: `~/Library/Logs/fintwin-ops-alert.log`.

## SIEM

Produção/staging: definir `FINTWIN_SIEM_HTTP_ENDPOINT` (Vector HTTP, Datadog, Splunk HEC). `pnpm ops:alert-check` e `pnpm siem:ping` enviam eventos JSON. Config de referência: `infra/siem/vector-fintwin.toml`. Ver `docs/WORM_SIEM.md`.

Logs JSON são compatíveis com ECS-like envelope (`toSiemEnvelope` em `logger.ts`). Correlacionar:

- `traceId` / `requestId` entre access log, app log e traces OTEL
- `journey` com SLOs (`docs/SLO.md`)
- Eventos de segurança existentes na BD (`SecurityEvent`) para auditoria forense

## Runbooks relacionados

- Continuidade: `docs/BUSINESS_CONTINUITY.md`
- Resposta a incidentes: `docs/INCIDENT_RESPONSE.md`
- PostgreSQL / Ollama / storage: `docs/runbooks/`
