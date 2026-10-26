# Game day — failover e restore (R6)

Exercício trimestral **além** do drill automático de backup (`backup-restore-drill.yml`).

## Objetivos

| Métrica | Alvo documentado |
|---------|------------------|
| RPO | 15 min (PITR) ou 24 h (dump diário) |
| RTO app | 1 h |
| RTO PostgreSQL | 4 h |

## Automatizado no repo

```bash
pnpm game-day:drill
```

Corre `backup-restore-drill.mjs` e grava evidência em `storage/backups/drill-reports/game-day-*.json`.

## Passos manuais (staging/produção)

1. **Failover RDS** — activar réplica / Multi-AZ fail-over; anotar `startedAt`, `healthyAt`.
2. **Rollback de imagem** — `pnpm deploy:rollout-check` ou workflow `deploy-rollout.yml` com tag anterior.
3. **Restore FTBACK01** — `docs/BACKUP_RESTORE.md`; nunca restaurar sobre `DATABASE_URL` sem `FINTWIN_RESTORE_CONFIRM=yes`.
4. **Health** — `/api/health` deve voltar a `ok`; se `critical` por `AuditTamperAttempt`, seguir `audit-ledger-incident.md`.
5. **Carga smoke** — `BASE_URL=https://staging... pnpm load:smoke`.

## Registo

Actualizar tabela em `docs/BUSINESS_CONTINUITY.md` (data, duração medida, issues).
