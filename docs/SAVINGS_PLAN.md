# Plano de Poupança

Modo de coordenação que reutiliza `SavingsGoal`, contribuições confirmadas pelo utilizador, contas, orçamentos mensais e `FinancialAlert`. A **activação** do plano não cria movimentos; cada **contribuição semanal** regista o progresso do objetivo e cria uma **transferência** (`Transfer` + dois lançamentos `TRANSFER`) da conta de origem (`SavingsPlan.sourceAccountId`, ou heurística «Caixa» / conta à ordem) para a conta de poupança do plano.

## Modelos

- `SavingsPlan` — liga objetivo, conta de poupança, cadência semanal e `activationKey` idempotente por workspace.
- `SavingsPlanBudgetRule` — limite mensal por categoria e limite de alerta (ex.: 75%).
- `SavingsPlanCheckIn` — período semanal; conclusão só com contribuição real.

## Activação

Wizard em `/planeamento` (modelo «Desafio 300 €»). Exige workspace `PERSONAL`. Pré-visualização e confirmação atómica; chave `fintwin-savings-challenge-300` evita duplo clique.

## Alertas

Tipos `SAVINGS_PLAN_*` e orçamentos do plano aos 75% (dedupe separado do limite global de 85%).

## Deploy

1. Aplicar migração `20261028220000_savings_plan` em dev/staging antes de produção.
2. `pnpm exec prisma migrate deploy` + `prisma generate`.
3. Utilizador inicia sessão → workspace pessoal → Planeamento → confirmar activação.

Rollback funcional: cancelar plano (`CANCELLED`) — não apaga dados financeiros.
