# Relatório Fase 17c — Análises financeiras

## Resumo executivo

Fase 17c entrega análises determinísticas (tendências, concentração, orçamentos, recorrências, anomalias, ligação a previsões) em **`/analises`** e resumo no **dashboard**. Pré-requisito cumprido: integridade do forecast (600 € + 600 € → **600 €** quando passivo ligado à recorrência).

**Portão:** lint ✓ · build ✓ · typecheck ✓ · **137** unitários ✓ · **40** E2E strict ×3 (0 retries).

**Migração:** `20261016140000_liability_recurring_link` (`linkedLiabilityId`, `paymentDueDayOfMonth`).

## Verificação forecast (obrigatória)

| Cenário | Comportamento |
|---------|----------------|
| Recorrência 600 € + passivo 600 € ligado | Só recorrência na projeção |
| Passivo sem dia de vencimento | Sem eventos de passivo |
| Mesmo valor/data sem ligação | **Não** deduplica (documentado) |

## Entregáveis

- `financial-insights.ts` + testes
- `getFinancialInsightsOverview`
- `/analises`, nav, dashboard highlights
- `e2e/09-financial-insights.spec.ts`
- `docs/FINANCIAL_INSIGHTS.md`

## Proposta Fase 18 (não iniciada)

Alertas persistentes, priorização e acompanhamento de acções sugeridas.

## Checkboxes

TodoWrite: `phase17c-01` … `phase17c-14`, `stage-17c`.
