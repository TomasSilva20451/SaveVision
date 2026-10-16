# Roadmap

Cada fase fecha com `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`.

1. Base — concluída: Next.js, PostgreSQL, Prisma, EUR e datas de Lisboa.
2. Autenticação com Argon2id — concluída: login, logout, cookie HttpOnly e limite de tentativas.
3. Workspaces e autorização no servidor — concluída: pessoais no seed, switcher e guards.
4. Contas, transações e motor decimal — concluída: `/contas`, `/transacoes`, transferências; receitas/despesas na Fase 5.
5. Receitas, familiar, e-commerce, ténis e despesas — concluída: `/receitas`, `/despesas`.
6. Dashboard, KPIs e gráficos — concluída: `/dashboard`.
7. Poupança, objetivos, score e simulador — concluída: `/planeamento`.
8. Conta conjunta por convite — concluída: `/conta-conjunta`.
9. Relatórios PDF/CSV, documentos e importação — concluída: `/relatorios`.
10. Investimentos educativos e cripto manual — concluída: `/investimentos`.
11. Previsões e insights determinísticos — concluída: `/previsoes`.
12. Seed, testes de ponta a ponta e verificação no browser — concluída: `pnpm test:e2e`, seed alargado.
13. Auditoria, segurança e estabilização — concluída: isolamento João/Maria, relatórios completos, E2E alargado, `docs/SECURITY_AUDIT.md`.
14. Experiência de utilização e design — concluída: primitivos UI, mobile, flash, dashboard/despesas (`docs/PROGRESS.md`).
15. Orçamentos, património e planeamento avançado — concluída: `/orcamentos`, `/patrimonio`, análise de despesas, passivos manuais, KPIs no dashboard, testes financeiros e E2E alargados.
16. Integridade patrimonial e fiabilidade — concluída: E2E com `storageState`, pagamentos de passivo atómicos, idempotência, snapshots, constraints SQL, audit parcial, backup/restore.
16.1. Consolidação integridade e segurança — concluída: testes WITH_BANK, idempotência transacional e concorrência, isolamento ampliado, restore guard.
17a. Despesas recorrentes determinísticas — concluída: `/despesas-recorrentes`, calendário, confirmação idempotente (`docs/RECURRING_EXPENSES.md`).
17a.1. Estabilização E2E recorrências — concluída: `anchorDate`, global-setup, Playwright CI (`docs/TESTING.md`).
17b. Previsões de tesouraria (determinísticas) — **concluída** (motor, `/previsoes`, E2E 08).
17b.1. Consolidação (E2E fail-closed, passivos monthlyPayment, UI, build) — **concluída**.
17c. Análises financeiras (`/analises`) — **concluída**.
17c.1. UI passivos ↔ recorrências (previsões) — **concluída**.
18. Alertas financeiros persistentes e priorizados — **concluída** (`/alertas`, `docs/FINANCIAL_ALERTS.md`).
19. Planeamento avançado e simulação de decisões — **concluída** (`/simulacoes`, `docs/FINANCIAL_SIMULATIONS.md`).
20. ML opcional — condicional.

Machine learning e Open Banking ficam atrás dos contratos em `src/server/providers/contracts.ts`.
