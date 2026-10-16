# Backup e restore (desenvolvimento)

## Backup

```bash
pnpm db:backup
```

Cria `storage/backups/fintwin-<timestamp>.dump` via `pg_dump` (formato custom). A pasta está no `.gitignore`. URLs Prisma com `?schema=public` são normalizadas antes do `pg_dump`/`pg_restore`.

## Restore

```bash
FINTWIN_RESTORE_DATABASE_URL="postgresql://..." pnpm db:restore storage/backups/fintwin-....dump
```

Se `FINTWIN_RESTORE_DATABASE_URL` coincidir com `DATABASE_URL`, o script aborta salvo `FINTWIN_RESTORE_CONFIRM=yes` (proteção contra restauro acidental na base principal).

Nunca apontes para a base principal sem confirmação explícita. Para validação, usa uma base temporária.

## Restore drill (manual)

1. `pnpm db:seed`
2. Anotar KPIs (contagens e património via UI ou SQL).
3. `pnpm db:backup`
4. Restaurar numa BD temporária.
5. Comparar contagens e smoke tests.

Automatização completa do drill fica como melhoria P2.

## Impedimentos comuns

- **Versão do cliente:** PostgreSQL 17 no Docker exige `pg_dump` 17 no host ou backup via `docker exec fintwin-postgres` (o script tenta Docker automaticamente se o contentor estiver activo).
- **Restore isolado:** criar BD temporária (`createdb fintwin_restore_test`), restaurar com `FINTWIN_RESTORE_DATABASE_URL=... pnpm db:restore ...`, comparar contagens, `dropdb fintwin_restore_test`. Não executar restore drill na base principal sem `FINTWIN_RESTORE_CONFIRM=yes`.
