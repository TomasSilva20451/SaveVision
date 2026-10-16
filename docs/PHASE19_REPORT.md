# Relatório Fase 19 — Simulações financeiras

## Estado

**COMPLETED** (sujeito ao portão verde).

## Commit prévio (Fase 18)

- `03a8e4f` — `fix: make financial alert refresh explicit`

## Funcionalidades

- Motor `financial-simulator.ts` (poupança, emergência, automóvel, amortização, cashflow, despesas, comparação).
- Integração tesouraria `financial-simulation-forecast.ts` + ação read-only `simulateTreasuryOneOffAction`.
- `/simulacoes` com formulários editáveis e cenário BASE autorizado.
- Comparação BASE / Cenário A / Cenário B.
- Sem migrações (sem persistência de cenários).

## Riscos remanescentes

- Amortização depende de taxa/prestação introduzidas pelo utilizador quando o passivo não tem `manualRatePercent`.
- Confirmação unificada recorrência/passivo: Fase 20 (`docs/UNIFIED_LIABILITY_PAYMENT_PROPOSAL.md`).

## Fase 20 proposta

Pagamento atómico recorrência ↔ passivo com testes de concorrência e idempotência.
