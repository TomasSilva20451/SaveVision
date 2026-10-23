# Continuidade de negócio (backups, RPO/RTO, 3-2-1)

Documento de referência **antes de aceitar dados reais de clientes**. Implementação técnica em `docs/BACKUP_RESTORE.md` e runbooks em `docs/runbooks/`.

## Objetivos

| Métrica | Alvo | Notas |
|--------|------|--------|
| **RPO** (perda máxima de dados) | **15 min** com PITR/WAL activo | **24 h** se só existirem dumps `pg_dump` diários |
| **RTO** PostgreSQL | **4 h** | Restauro validado + migrações Prisma |
| **RTO** aplicação FinTwin | **1 h** | Redeploy imagem ou `next start` + health |
| **RTO** documentos (`storage/documents`) | **4 h** | Restauro tarball + volume Docker |
| **RTO** Ollama | **N/A (degradado)** | Core financeiro funciona; IA local fica offline |

## Política 3-2-1

1. **3 cópias** dos dados críticos: produção activa + backup local/cifrado + réplica off-site.
2. **2 tipos de suporte**: volume PostgreSQL (disco) + ficheiros de backup (dump cifrado, WAL, tarball documentos).
3. **1 cópia off-site** geograficamente separada (object storage, NAS remoto, ou `rclone` para outro datacenter).

Automatização: `pnpm db:backup:run` (cifra + manifesto + sync opcional). Cron recomendado: dump completo diário; WAL contínuo quando PITR estiver activo.

## Componentes críticos

| Componente | Criticidade | Degradação |
|------------|-------------|------------|
| PostgreSQL | **Crítico** | App indisponível |
| `storage/documents` | **Alto** | Relatórios/recibos sem download |
| Ollama | **Baixo** | Sugestões, narrativas e ajuda passam a fallback determinístico |
| Auth / sessões | **Alto** | Recuperável da BD; sem BD não há login |

## Backups automáticos cifrados

- **Omissão dev:** `pnpm db:backup` (dump em claro em `storage/backups/`, gitignored).
- **Produção:** definir `FINTWIN_BACKUP_ENCRYPTION_SECRET` (≥ 32 caracteres) e executar `pnpm db:backup:run`.
- Formato: `pg_dump -Fc` + AES-256-GCM (OpenSSL PBKDF2). Manifesto JSON com SHA-256 por ficheiro.
- **Off-site:** `FINTWIN_BACKUP_OFFSITE_COMMAND` com placeholders `$FILE` e `$BASENAME` (ex.: `rclone copy $FILE remote:fintwin-backups/`).

## Point-in-time recovery (PITR)

- **Produção gerida** (RDS, Cloud SQL, Supabase, etc.): activar backups contínuos + retenção WAL no painel do fornecedor; documentar janela e procedimento de restore PITR no runbook PostgreSQL.
- **Local / referência:** `docker compose -f docker-compose.yml -f docker-compose.pitr.yml up -d`, WAL em `storage/wal_archive/`, base com `pnpm db:pitr:base`.
- RPO efectivo com WAL ≈ intervalo de arquivo + latência off-site (alvo **15 min**).

## Testes trimestrais de restauro

- Script: `pnpm db:backup:drill` (backup → BD temporária `fintwin_drill_*` → comparar contagens → relatório em `storage/backups/drill-reports/`).
- CI: workflow `.github/workflows/backup-restore-drill.yml` (1.º dia de Jan/Abr/Jul/Out + `workflow_dispatch`).
- Registar no relatório: data, duração, responsável, issues abertas.

## Indisponibilidade por componente

Runbooks detalhados:

- [PostgreSQL indisponível](runbooks/postgresql-unavailable.md)
- [Ollama indisponível](runbooks/ollama-unavailable.md)
- [Armazenamento de documentos indisponível](runbooks/storage-unavailable.md)
- [Incidente de backup/restauro](runbooks/backup-restore-incident.md)

## Checklist pré-clientes reais

- [ ] `FINTWIN_BACKUP_ENCRYPTION_SECRET` em cofre (não no git)
- [ ] Off-site configurado e testado
- [ ] PITR ou dumps ≥ diários com retenção ≥ 30 dias
- [ ] Drill trimestral verde (CI ou manual documentado)
- [ ] RPO/RTO acordados com stakeholders
- [ ] Runbooks acessíveis à equipa on-call
