# Simulações financeiras (Fase 19)

Motor puro: `src/lib/finance/financial-simulator.ts`. Recolha autorizada de BASE: `getSimulationBaseline` (somente leitura).

## Diferença previsão vs simulação

| | Previsão (`/previsoes`) | Simulação (`/simulacoes`) |
|--|-------------------------|---------------------------|
| Dados | Ocorrências e passivos conhecidos | BASE + parâmetros hipotéticos |
| BD | Lê dados reais | **Não escreve** |
| Objetivo | Tesouraria provável | Comparar decisões |

## Fórmulas (resumo)

- **Poupança mensal**: saldo inicial + contribuições; juros mensais `r = taxaAnual/12/100` aplicados antes da contribuição (fim de mês).
- **Fundo de emergência**: objetivo = despesas essenciais × meses; tempo = ceil(gap/contribuição).
- **Prestação fixa**: sistema francês com taxa mensal explícita; taxa 0 → capital/prazo.
- **Amortização extra**: simula REDUCE_TERM ou REDUCE_PAYMENT sem alterar `FinancialLiability`.

## Limitações

- Taxas e prazos são **parâmetros do utilizador**, nunca inventados.
- Automóvel: custos opcionais omitidos são listados em `limitations`.
- Confirmação unificada recorrência/passivo: ver `docs/UNIFIED_LIABILITY_PAYMENT_PROPOSAL.md`.
