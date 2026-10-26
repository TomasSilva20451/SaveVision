# Roadmap de funcionalidades ML (§11)

Ordem de entrega **com governação pronta** (`docs/ML_GOVERNANCE.md`, `pnpm ml:eval` bloqueante). Nenhuma capacidade escreve movimentos sem confirmação humana onde indicado.

| # | Capacidade | Estado | Onde |
|---|------------|--------|------|
| 1 | Normalização de comerciantes | **Feito** | `merchant-normalization.ts`, golden pt-PT |
| 2 | Anomalias comportamentais | **Feito** | `expense-anomaly-detection.ts`, insights/alertas |
| 3 | P10/P50/P90 | **Feito** | `probabilistic-forecast.ts`, `/inteligencia` |
| 4 | Risco de liquidez | **Feito** | `assessLiquidityRisk`, assistente + `/inteligencia` |
| 5 | Document intelligence | **Feito** | `receipt-extraction`, `runGovernedMl`, confirmação UI |
| 6 | Poupança explicável | **Feito** | `explainableSavingsRecommendation` |
| 7 | Copiloto reconciliação | **Feito** | `copilotSuggestions`, confirmação manual |
| 8 | Assistente empresarial | **Feito** | intenções read-only + tesouraria/reconciliação |

## Fase posterior (bloqueada)

`DEFERRED_HIGH_RISK_ML` em `registry.ts`: fraude formal, AML, credit scoring, robo-advice. `assertMlCapabilityNotDeferred` impede activação acidental.

## Release

- Eval suite **1.1.0**: registo, manifest de prompts, golden comerciantes, red-team injection, golden advisory probabilístico.
- Staging/prod: último `MlEvaluationRun` PASSED &lt; 30 dias para `/inteligencia` e tools advisory do assistente.
