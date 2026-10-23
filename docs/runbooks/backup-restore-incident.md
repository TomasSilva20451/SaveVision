# Runbook: incidente de backup ou restauro

**Quando usar:** backup falhou repetidamente; ficheiro cifrado corrompido; drill trimestral falhou; restauro acidental na BD errada.

## Severidade

| Situação | Severidade |
|----------|------------|
| Backup diário falhou 1× | Baixa — repetir manualmente |
| Off-site desactualizado > 48 h | Média |
| Drill falhou ou RPO violado | Alta |
| Restauro na BD de produção sem janela | Crítica |

## 1. Backup falhou

1. Ler saída de `pnpm db:backup:run` ou cron.
2. Causas comuns: `pg_dump` versão ≠ Postgres 17; Docker parado; disco cheio em `storage/backups/`.
3. Corrigir e executar backup manual; verificar manifesto SHA-256.
4. Confirmar cópia off-site (listar bucket/remoto).

## 2. Ficheiro cifrado inválido

1. Comparar SHA-256 local vs manifesto JSON.
2. Tentar ficheiro anterior dentro da retenção (`FINTWIN_BACKUP_RETENTION_DAYS`).
3. Se PITR activo, preferir restore PITR em vez de dump antigo.

## 3. Drill falhou (`pnpm db:backup:drill`)

1. Abrir relatório em `storage/backups/drill-reports/`.
2. Se contagens divergem: investigar migrations aplicadas só na origem, ou dump incompleto.
3. Não promover release até drill verde.

## 4. Restauro acidental

- `db-restore.sh` bloqueia alvo = `DATABASE_URL` salvo `FINTWIN_RESTORE_CONFIRM=yes`.
- Se ocorreu: avaliar PITR ou dump anterior; contactar runbook PostgreSQL.

## 5. Comunicação

- Registar: início, fim, RPO/RTO efectivos, acções correctivas.
- Actualizar checklist em `docs/BUSINESS_CONTINUITY.md` se política mudar.
