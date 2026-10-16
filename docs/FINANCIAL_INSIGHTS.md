# Análises financeiras (Fase 17c)

Motor puro: `src/lib/finance/financial-insights.ts`. Serviço: `src/server/services/financial-insights.ts`.

## Princípios

- Determinístico, explicável, **sem ML**.
- Só dados do workspace autorizado.
- Realizado ≠ previsto (previsões vêm de `/previsoes` / tesouraria).
- Transferências não são despesas.
- Despesas `COMPLETED`; receitas `COMPLETED` para comparativos.

## Métricas

| Insight | Regra |
|---------|--------|
| Tendência mensal despesas | `safePercentChange` vs mês anterior; alerta se > 5% |
| Tendência categoria | 3 meses consecutivos a subir |
| Concentração | Top 3 categorias ≥ 50% do total do mês |
| Orçamento | `budgetOverage` > 0 |
| Subscrições | Soma equivalente mensal × 12 (não é gasto realizado) |
| 7 dias previstos | Saídas do forecast 17b no horizonte 7 |
| Anomalia | Mediana + 2×MAD, mínimo 5 observações históricas |

## Severidades

`INFORMATION`, `POSITIVE`, `ATTENTION`, `WARNING`.

## Integridade forecast (17b.1/17c)

- Recorrência com `linkedLiabilityId` → passivo **não** gera eventos duplicados.
- Passivo sem `paymentDueDayOfMonth` → **não** projecta datas de caixa.

## Limitações

- Sem inferência recorrência↔passivo por valor/data.
- Pouco histórico → mensagem «Dados limitados».
- Anomalias não implicam fraude.
