# Progresso FinTwin

## Fase 19 (simulações financeiras)

Estado: **COMPLETED** (após portão).

- Motor `src/lib/finance/financial-simulator.ts` + forecast `financial-simulation-forecast.ts`.
- UI `/simulacoes` com formulários reais e comparação BASE/A/B.
- Commit alertas: `03a8e4f`.

## Fase 18 (alertas financeiros)

Estado: **COMPLETED**.

- Modelos `FinancialAlert` e `FinancialAlertUserState`.
- Motor `src/lib/finance/financial-alerts.ts` + sync `src/server/services/financial-alerts.ts`.
- UI `/alertas`, secção no dashboard, contador na navegação.
- Proteção UX/servidor pagamento duplicado recorrência ↔ passivo (ack explícito).
- Ver `docs/FINANCIAL_ALERTS.md`.

## Fase 17c.1 (integração passivos ↔ recorrências)

Estado: **COMPLETED**.

- UI `paymentDueDayOfMonth` e `linkedLiabilityId`.
- Regras de previsão e avisos documentados.
- Ver `docs/LIABILITY_RECURRING_INTEGRATION.md`.

## Fase 17c

Análises em `/analises`.

## Portão

```bash
pnpm gate
CI=1 pnpm test:e2e:strict
```

Última verificação: **165** unitários; **69** E2E strict ×3 (0 failed, 0 skipped, 0 retries).
