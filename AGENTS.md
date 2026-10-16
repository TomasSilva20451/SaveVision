<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FinTwin

Aplicação financeira privada. Nome configurável em `APP_NAME` (omissão: FinTwin). UI em pt-PT, moeda EUR, timezone `Europe/Lisbon`.

## Decisões permanentes

- Modular monolith em Next.js App Router. Sem microserviços nesta versão.
- PostgreSQL via Docker Compose e Prisma ORM 7.10 (estável). O CLI 8 ainda estava em release candidate na Fase 1, por isso não foi adotado.
- Dinheiro é `Decimal` (`decimal.js` no domínio, `Decimal` na base quando os movimentos existirem). Nunca somar com `number`.
- Datas civis (dia e mês de um movimento) calculam-se em `Europe/Lisbon`. Timestamps guardam o instante. Não derivar o mês com `toISOString().slice(0, 10)`.
- Todo o dado financeiro futuro pertence a um `workspaceId`. Membership num workspace conjunto não abre o workspace pessoal do outro utilizador.
- Adaptadores externos vivem atrás de interfaces em `src/server/providers/contracts.ts`. Não há integração bancária, custódia cripto nem modelo de machine learning.
- Não criar botões sem comportamento. Não marcar uma fase como feita se os testes falharem.

## Portão de cada fase

`pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` têm de passar, incluindo os testes das fases anteriores. A partir da Fase 13 inclui também `pnpm test:e2e`.

## Gestão do plano (permanente)

- Atualizar os TODOs do Cursor (`TodoWrite`) para **COMPLETED** assim que uma tarefa ou subfase for implementada **e** validada (testes relevantes verdes).
- Não marcar tarefas concluídas com checkboxes vazios no plano lateral.
- Manter `docs/ROADMAP.md` e `docs/PROGRESS.md` alinhados com o plano nativo.
- Só marcar uma fase como concluída depois do portão completo passar.

## Fase 1

Identidade (`User`, `Workspace`, `WorkspaceMember`), formatadores EUR, datas civis e o contrato de acesso por workspace.

## Fase 2

Auth.js 5.0.0-beta.32 (o tag estável `next-auth` ainda aponta para a v4). Credenciais, Argon2id e cookie de sessão HttpOnly. O limite de tentativas é em memória. A sidebar só liga a rotas que existem.

## Fase 3

Cada utilizador tem um workspace `PERSONAL` criado no seed. Autorização no servidor: `requireWorkspaceAccess`, `requireWorkspaceRole`, `requireWorkspaceEditor`, `requireWorkspaceManager`. O switcher só lista memberships `ACTIVE`. Cookie `fintwin_workspace` guarda o espaço selecionado.

## Fase 4

Contas e movimentos com `Decimal` na base. Transferências geram dois lançamentos `TRANSFER` com montantes com sinal; receita e despesa ignoram `TRANSFER`. Motor em `src/lib/finance/aggregates.ts`.

## Fase 5

Receitas (`/receitas`), despesas (`/despesas`), familiar com ocorrências `EXPECTED`/`RECEIVED`, e-commerce e ténis com líquidos calculados no servidor. Confirmar receção é idempotente via `transactionId` único na ocorrência. Regras em `docs/FINANCIAL_RULES.md`.

## Fase 6

Dashboard (`/dashboard`) com KPIs da base de dados, gráficos Recharts, `safePercentChange` em `src/lib/finance/kpi.ts` para evitar NaN.

## Fase 7

Planeamento (`/planeamento`): objetivos, contribuições, fundo de emergência, Financial Health Score explicável, simulador local, Smart Cash Sweep só como sugestão, registo manual de produtos CGD (sem taxas inventadas).

## Fase 8

Conta conjunta (`/conta-conjunta`): criação `JOINT`, convites, aceitação, membros e objetivos conjuntos. Acesso só via membership `ACTIVE`; workspace conjunto não abre workspaces pessoais.

## Fase 9

Relatórios (`/relatorios`): PDF e CSV no servidor (`pdfkit`), documentos em `storage/documents` com chave aleatória, download autenticado em `/api/documents/[id]`.

## Fase 10

Investimentos (`/investimentos`): posições manuais, P/L com preço introduzido pelo utilizador. Sem trading nem chaves privadas.

## Fase 11

Previsões (`/previsoes`): `deterministicForecastProvider`, projeções e alertas por regras. Não declarar machine learning.

## Fase 12

Seed alargado, Playwright em `e2e/` (`pnpm test:e2e`), README atualizado. Portão: lint, typecheck, test, build.

## Fase 13

Auditoria e estabilização: validação de contas por workspace, relatórios PDF/CSV por intervalo com totais coerentes, sniff de documentos, testes de isolamento (`src/server/security/workspace-isolation.test.ts`), E2E alargado, `ensureRequestDynamic()` nas rotas com sessão. Ver `docs/SECURITY_AUDIT.md` e `docs/TESTING.md`.

## Fase 14

UX e design: primitivos em `src/components/ui/`, `MainNav`/`MobileNav`, feedback flash (`lib/ui/flash.ts`), dashboard e despesas repaginados. Plano e TODOs atualizados via `TodoWrite`; acompanhamento em `docs/PROGRESS.md`.

## Fase 15

Orçamentos (`/orcamentos`), património e passivos (`/patrimonio`), análise de despesas (Recharts), extensão de objetivos com cenários, KPIs no dashboard. Motor em `src/lib/finance/budget.ts`, `patrimony.ts`, `goal-projection.ts`. Portão inclui E2E alargados.

## Fase 18

Alertas financeiros persistentes (`FinancialAlert`, `FinancialAlertUserState`): motor determinístico em `src/lib/finance/financial-alerts.ts`, sync em `src/server/services/financial-alerts.ts`, UI `/alertas` e dashboard. Estado de leitura por utilizador; deduplicação por `(workspaceId, deduplicationKey)`. Reutiliza previsões, orçamentos e insights; não cria transações. Avisos de pagamento duplicado recorrência/passivo com confirmação explícita. Ver `docs/FINANCIAL_ALERTS.md`.
