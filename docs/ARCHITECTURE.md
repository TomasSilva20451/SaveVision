# Arquitetura

FinTwin é um modular monolith. A Fase 1 estabelece a base sobre a qual as fases seguintes acrescentam domínio, sem mudar de stack.

```
src/app            rotas e páginas
src/lib/finance    cálculos monetários puros
src/lib/datetime   datas civis de Lisboa
src/lib/permissions isolamento por workspace
src/lib/db         cliente Prisma único
src/server/providers contratos de integrações futuras
```

A lógica de negócio não fica em componentes React. O browser não consulta a base de dados diretamente.

## Base de dados

PostgreSQL 17 em Docker Compose, publicado em `localhost:5433` porque a porta 5432 já estava ocupada nesta máquina. O cliente Prisma 7 usa o adapter `@prisma/adapter-pg`. A URL está em `DATABASE_URL` e é lida por `prisma7.config.ts`.

O schema desta fase cobre utilizador, workspace e membership. Contas, movimentos e relatórios entram nas fases seguintes, sempre com `workspaceId`.

## Operações e continuidade

- Dados financeiros: PostgreSQL (fonte de verdade).
- Ficheiros privados: `storage/documents` (volume Docker em deploy; fora de `public/`).
- Ollama: opcional, localhost; falhas degradam IA, não o core.
- Backups: `pnpm db:backup:run`, política 3-2-1 e runbooks em `docs/BUSINESS_CONTINUITY.md`.

## Integrações futuras

`StorageProvider`, `BankDataProvider`, `MarketDataProvider`, `CryptoPriceProvider`, `ForecastProvider` e `InsightProvider` são contratos vazios de implementação. Nenhum deles fala com serviços externos.
