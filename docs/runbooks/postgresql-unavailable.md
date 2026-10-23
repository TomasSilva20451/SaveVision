# Runbook: PostgreSQL indisponível

**Sintomas:** `/api/health` com `degraded` ou 503; erros Prisma na app; login impossível.

**RTO alvo:** 4 h | **RPO alvo:** 15 min (PITR) ou 24 h (só dump diário)

## 1. Deteção e contenção (0–15 min)

1. Confirmar health: `curl -sS https://<host>/api/health | jq`.
2. Verificar processo/ligação: contentor Postgres, CPU/disco, conexões esgotadas.
3. Comunicar incidente (canal interno); evitar restauros destrutivos até identificar causa.

## 2. Diagnóstico rápido

| Causa provável | Acção |
|----------------|--------|
| Contentor parado | `docker compose up -d postgres` ou equivalente cloud |
| Disco cheio | Libertar WAL/logs; expandir volume |
| Credenciais rotacionadas | Actualizar `DATABASE_URL` + redeploy app |
| Corrupção / migration falhada | Seguir secção 3 |

Logs: `docker logs fintwin-postgres --tail 200` ou logs do serviço gerido.

## 3. Recuperação

### 3.a Serviço gerido com PITR

1. Abrir consola do fornecedor → **Restore to point in time** (timestamp UTC antes do incidente).
2. Nova instância ou overwrite conforme política; actualizar `DATABASE_URL`.
3. `pnpm db:deploy` se a instância estiver vazia ou atrás de migrations.
4. Smoke: login, listar transacções, património.

### 3.b Dump cifrado local

1. Obter último `.dump.enc` off-site + manifesto JSON.
2. Decifrar (ver `docs/BACKUP_RESTORE.md`).
3. Restaurar para BD nova; **não** sobre produção sem janela e `FINTWIN_RESTORE_CONFIRM=yes`.
4. Apontar app para BD restaurada; validar contagens vs manifesto/drill anterior.

### 3.c Desenvolvimento (Docker local)

```bash
docker compose up -d postgres
pnpm db:deploy
# Se BD vazia e aceitável: pnpm db:seed (apenas dev/demo)
```

## 4. Pós-incidente

- Root cause documentado; ticket fechado com duração real vs RTO.
- Se RPO violado, rever frequência WAL/dump e off-site.
- Agendar drill extra se o restauro não foi testado nos últimos 90 dias.
