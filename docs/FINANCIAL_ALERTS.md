# Alertas financeiros (Fase 18)

Sistema interno persistente, determinístico e explicável. **Não cria transações** nem altera saldos.

## Tipos iniciais

| Tipo | Origem |
|------|--------|
| `NEGATIVE_PROJECTED_BALANCE` / `LOW_PROJECTED_BALANCE` | `getTreasuryForecast` / projeção 30 dias |
| `BUDGET_EXCEEDED` / `BUDGET_NEAR_LIMIT` | Orçamento mensal (realizado vs limite) |
| `RECURRING_EXPENSE_OVERDUE` / `RECURRING_EXPENSE_DUE` | Ocorrências EXPECTED/POSTPONED |
| `EXPECTED_INCOME_OVERDUE` | `IncomeOccurrence` EXPECTED |
| `UNUSUAL_EXPENSE` | Insight `ANOMALY` de `financial-insights.ts` |
| `EMERGENCY_FUND_BELOW_TARGET` | Planeamento / poupança vs objetivo |
| `RECURRING_LIABILITY_CONFIGURATION` | Avisos passivo ↔ recorrência |
| `DUPLICATE_PAYMENT_RISK` | Recorrência ACTIVE com `linkedLiabilityId` |

## Prioridades

- **CRITICAL**: saldo agregado projetado negativo (30 dias).
- **HIGH**: recorrência vencida; risco de pagamento duplicado (associação explícita).
- **ATTENTION**: orçamento excedido, receita atrasada, fundo de emergência, saldo baixo projetado.
- **INFO**: orçamento perto do limite; anomalias informativas.

## Deduplicação

Constraint única `(workspaceId, deduplicationKey)`. Chave estável: workspace + tipo + identificadores de fonte/período (nunca título ou montante).

## Ciclo de vida

- **Alerta (workspace)**: `ACTIVE` | `RESOLVED` (condição financeira).
- **Utilizador**: `seenAt`, `dismissedAt` em `FinancialAlertUserState` (por membro, incl. conta conjunta).

## Reavaliação

A listagem em `/alertas` e no dashboard **não** reavalia alertas (sem escritas na BD). A reavaliação idempotente faz-se apenas via ação explícita «Atualizar alertas» (`syncFinancialAlertsAction`), com autorização de workspace.

## Pagamento duplicado (17c.1)

`linkedLiabilityId` evita dupla contagem na **previsão**, não unifica confirmação. Confirmação de recorrência ou pagamento WITH_BANK exige checkbox `acknowledgeLinkedLiabilityRisk` quando há associação ativa; bloqueio adicional só com evidência fiável (pagamento ligado na janela de 14 dias).

## Futuro

Confirmação financeira unificada e atómica entre ocorrência de recorrência e `LiabilityPayment` (Fase posterior).
