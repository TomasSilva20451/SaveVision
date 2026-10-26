# WORM auditoria + SIEM (R5)

## Arquivo imutável (WORM)

1. **Operacional:** cada `appendAuditEvent` escreve JSONL em `storage/audit/<env>/audit-events.jsonl` (`audit-ledger.ts`).
2. **Cloud:** bucket `fintwin-<env>-audit-worm` (Terraform `audit_worm.tf`) com Object Lock + KMS.
3. **Sync:** cron diário ou pós-backup:

```bash
export FINTWIN_AUDIT_WORM_BUCKET=$(terraform -chdir=infra/terraform output -raw audit_worm_bucket)
pnpm audit:worm:sync
```

`--dry-run` valida credenciais AWS sem upload.

## SIEM

| Variável | Função |
|----------|--------|
| `FINTWIN_SIEM_HTTP_ENDPOINT` | URL ingestão (Vector HTTP, Datadog logs, Splunk HEC) |
| `FINTWIN_SIEM_TOKEN` | Bearer opcional |
| `FINTWIN_OPS_WEBHOOK_URL` | Alertas operacionais (Slack/Teams) |

`pnpm ops:alert-check` envia para **webhook** e **SIEM** quando configurados.

Teste manual:

```bash
pnpm siem:ping
```

Config Vector de referência: `infra/siem/vector-fintwin.toml`.

## Alertas mínimos

- `/api/health` `critical` (incl. `AuditTamperAttempt`)
- `unavailableDocuments > 0`
- Spike `fintwin_login_attempts_total{result="failure"}`
- Falha workflow DAST High novo

Ver `docs/OBSERVABILITY.md` e `docs/INCIDENT_RESPONSE.md`.
