# Backup, restore e PITR

Política de continuidade (RPO/RTO, 3-2-1, runbooks): **`docs/BUSINESS_CONTINUITY.md`**.

## Comandos

| Comando | Uso |
|---------|-----|
| `pnpm db:backup` | Dump PostgreSQL (`pg_dump -Fc`) → `storage/backups/fintwin-<timestamp>.dump` |
| `pnpm db:backup:run` | Dump + documentos + cifra opcional + manifesto + off-site + retenção |
| `pnpm db:restore <ficheiro>` | `pg_restore` para `FINTWIN_RESTORE_DATABASE_URL` |
| `pnpm db:backup:drill` | Teste trimestral automatizado (contagens) |
| `pnpm db:pitr:base` | Base backup com WAL (perfil PITR local) |

## Backup simples (desenvolvimento)

```bash
pnpm db:backup
```

URLs Prisma com `?schema=public` são normalizadas (`scripts/pg-url-for-cli.sh`). Se o contentor `fintwin-postgres` estiver activo, o dump corre via `docker exec`.

## Backup automático cifrado (pré-produção / produção)

Configuração operacional (ficheiro **gitignored** `.env.backup.local`):

```bash
pnpm backup:setup
pnpm backup:setup -- --dev-offsite   # rclone local → ~/FinTwin-backups-offsite (dev)
pnpm backup:install-cron             # diário 01:15 UTC
pnpm db:backup:run                   # teste imediato
```

Modelo: `.env.backup.example`. Variáveis principais:

- `FINTWIN_BACKUP_ENCRYPTION_SECRET_FILE` — caminho para um segredo ≥ 32 caracteres num cofre/ficheiro 0600 (gerado por `backup:setup`). O valor não fica no `.env`.
- `FINTWIN_BACKUP_ENCRYPTION_KEY_ID` — identificador versionado e prefixado pelo ambiente, por exemplo `production-backup-v1`.
- `FINTWIN_RCLONE_REMOTE` + `FINTWIN_RCLONE_PREFIX` — off-site via `scripts/backup-offsite-rclone.sh`.
- `FINTWIN_BACKUP_OFFSITE_COMMAND` — omissão: wrapper rclone acima.
- `FINTWIN_BACKUP_RETENTION_DAYS` — omissão 30.
- `FINTWIN_BACKUP_DELETE_PLAINTEXT=yes` — remove `.dump` em claro após cifrar.

Produção (S3/B2): `RCLONE_CONFIG=.rclone.conf rclone config` e remoto real no lugar de `--dev-offsite`.

Gera manifesto `manifest-fintwin-<timestamp>.json` com SHA-256. Documentos e o arquivo independente de auditoria são empacotados, cifrados e enviados off-site juntamente com o dump.

### Restaurar um dump cifrado

```bash
FINTWIN_RESTORE_DATABASE_URL="postgresql://..." \
  pnpm db:restore storage/backups/fintwin-....dump.enc
```

O restore lê a chave pelo ficheiro configurado, valida o `keyId` e a tag GCM e só então cria um temporário 0600. Backups adulterados ou truncados são recusados; o temporário é removido ao terminar.

## Restore

```bash
FINTWIN_RESTORE_DATABASE_URL="postgresql://..." pnpm db:restore storage/backups/fintwin-....dump
```

Se o alvo coincidir com `DATABASE_URL`, o script aborta salvo `FINTWIN_RESTORE_CONFIRM=yes`. **Preferir BD temporária** (`fintwin_restore_test`).

## Point-in-time recovery (PITR)

**Produção:** usar PITR nativo do fornecedor PostgreSQL gerido (recomendado para RPO 15 min).

**Referência local:**

```bash
docker compose -f docker-compose.yml -f docker-compose.pitr.yml up -d
pnpm db:pitr:base
# WAL em storage/wal_archive/
```

Recovery físico depende da versão PostgreSQL (`pg_combinebackup`, recovery.signal, etc.) — documentar no runbook após escolha de hosting.

## Drill de restauro (trimestral)

```bash
FINTWIN_ENV=e2e pnpm db:backup:drill
```

Cria `fintwin_drill_*`, restaura o dump mais recente, compara contagens (`User`, `Workspace`, `Transaction`), grava relatório JSON e apaga a BD temporária. Bloqueado em `staging`/`production` excepto `FINTWIN_BACKUP_DRILL=yes`.

CI: workflow `backup-restore-drill.yml` (Jan/Abr/Jul/Out).

## Impedimentos comuns

- **Versão do cliente:** Postgres 17 exige `pg_dump` 17 ou contentor Docker activo.
- **Restore isolado:** nunca na base principal sem confirmação explícita.
- **Off-site:** validar periodicamente listagem remota, não só upload.
