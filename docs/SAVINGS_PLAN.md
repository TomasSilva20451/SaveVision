# Plano de Poupança

Modo de coordenação que reutiliza `SavingsGoal`, contribuições confirmadas pelo utilizador, contas, orçamentos mensais e `FinancialAlert`. A **activação** do plano não cria movimentos; cada **contribuição semanal** regista o progresso do objetivo e cria uma **transferência** (`Transfer` + dois lançamentos `TRANSFER`) da conta de origem (`SavingsPlan.sourceAccountId`, ou heurística «Caixa» / conta à ordem) para a conta de poupança do plano.

## Modelos

- `SavingsPlan` — liga objetivo, conta de poupança, cadência semanal e `activationKey` idempotente por workspace.
- `SavingsPlanBudgetRule` — limite mensal por categoria e limite de alerta (ex.: 75%).
- `SavingsPlanCheckIn` — período semanal; conclusão só com contribuição real.

## Activação

Wizard em `/plano` (botão «Criar plano de poupança»; modelo «Desafio 300 €»). Exige workspace `PERSONAL`. Pré-visualização e confirmação atómica; chave `fintwin-savings-challenge-300` evita duplo clique.

## Alertas

Tipos `SAVINGS_PLAN_*` e orçamentos do plano aos 75% (dedupe separado do limite global de 85%).

## Deploy

1. Migrações Prisma na **mesma** base que o Vercel (`DATABASE_URL` Production), incluindo `20261031120000_savings_plan_source_transfer` (origem + `transferId` na contribuição). Passo a passo: [VERCEL_GITHUB_DEPLOY.md § Migrações Neon](VERCEL_GITHUB_DEPLOY.md#migrações-neon-manualmente-savevision--vercel) — comando habitual: `pnpm db:deploy:vercel-neon`.
2. Deploy da app (`git push` ou `vercel --prod`); o build também corre `prisma migrate deploy`.
3. Utilizador inicia sessão → **Dashboard** (repara transferências em falta) ou plano → **Criar transferências em falta** → confirmar **Transações** / **Contas**.

Rollback funcional: cancelar plano (`CANCELLED`) — não apaga dados financeiros.
