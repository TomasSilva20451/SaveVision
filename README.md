# FinTwin

Gestão financeira privada para dois utilizadores, com espaços pessoais separados e workspace conjunto por convite.

## Funcionalidades (Fases 1 a 12)

- Autenticação local (Auth.js, Argon2id) e workspaces com cookie `fintwin_workspace`
- Contas, transações, transferências e motor decimal (`Europe/Lisbon`)
- Receitas (familiar, e-commerce, ténis) e despesas com categorias
- Dashboard com KPIs e gráficos a partir da base de dados
- Planeamento: objetivos, fundo de emergência, health score, simulador, registo CGD manual
- Conta conjunta: convites, membros, objetivos partilhados (isolamento de dados pessoais)
- Relatórios PDF/CSV e upload de documentos privados
- Investimentos manuais e previsões determinísticas (sem ML)
- Testes unitários (Vitest) e E2E (Playwright)

## Stack

- Next.js 16 (App Router) e TypeScript strict
- Tailwind CSS 4
- PostgreSQL 17 e Prisma ORM 7.10
- Vitest e Playwright
- pnpm

## Requisitos

- Node.js 24+ (Node 25 foi usado em desenvolvimento)
- pnpm 10
- Docker

## Arranque

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Contas de desenvolvimento:

- `user1@example.local` / `demo-joao-2026` (João)
- `user2@example.local` / `demo-maria-2026` (Maria)

A aplicação fica em [http://localhost:3000](http://localhost:3000). Health: [http://localhost:3000/api/health](http://localhost:3000/api/health). Postgres em `localhost:5433`.

## Verificação (inclui Fase 13)

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Documentação de testes e auditoria: `docs/TESTING.md`, `docs/SECURITY_AUDIT.md`.

O Playwright arranca o servidor de desenvolvimento se ainda não estiver a correr. Na primeira execução instala os browsers:

```bash
pnpm exec playwright install chromium
```

## Variáveis

| Nome | Função |
| --- | --- |
| `APP_NAME` | Nome na interface (omissão: FinTwin) |
| `DATABASE_URL` | Ligação PostgreSQL |
| `AUTH_SECRET` | Segredo da sessão (≥ 32 caracteres) |

Documentação adicional: `docs/ARCHITECTURE.md`, `docs/FINANCIAL_RULES.md`, `docs/SECURITY.md`, `AGENTS.md`.

Não commits o ficheiro `.env`.
