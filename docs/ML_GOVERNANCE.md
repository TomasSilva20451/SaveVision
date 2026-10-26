# Governação de Machine Learning

## Princípio

O FinTwin usa modelos locais apenas como componentes **opcionais e não autoritativos**. Cálculos financeiros, autorização, isolamento por workspace e escritas continuam no servidor. Uma saída de modelo nunca cria, altera, reconcilia ou elimina um movimento por si só.

## Registo e versionamento

`src/lib/ml/registry.ts` é o catálogo fechado de capacidades **LLM**. Para cada uma regista finalidade, família/modelo por omissão, versão do prompt, limite de latência/tokens, fallback e necessidade de revisão humana. Alterar um prompt exige incrementar a sua versão, actualizar `ml/prompts/manifest.json` e o golden dataset relevante.

Capacidades **advisory determinísticas** (P10/P90, liquidez, copiloto reconciliação, etc.) estão em `src/lib/ml/advisory-registry.ts` — sem LLM, mas sujeitas ao eval gate em staging/produção.

Prompts versionados: `ml/prompts/manifest.json` validado em `pnpm ml:eval` via `validatePromptManifestAgainstRegistry()`.

As execuções são registadas em `MlInvocationEvent` com hashes de entrada/saída, versão de modelo/prompt, resultado, latência, confiança e motivo de fallback. Por omissão não se guarda o prompt. Quando o utilizador aceitou `prompt_storage`, só é retido um excerto truncado durante sete dias.

## Avaliações obrigatórias

`pnpm ml:eval` (suite **1.1.0**) valida antes de cada release:

- cobertura integral do registo LLM;
- manifest de prompts alinhado com `ML_REGISTRY`;
- normalização de comerciantes no golden dataset pt-PT;
- red-team de prompt injection em pt-PT;
- golden advisory probabilístico (bandas ordenadas, risco HIGH);
- limiares explícitos e falha com código diferente de zero.

O comando integra `pnpm gate` e `pnpm ci:verify`; por isso um release não avança se a avaliação falhar. Os dados ficam em `ml/golden/` e `ml/red-team/`, versionados com o código. `MlEvaluationRun` permite conservar o resultado de releases promovidos.

No portão reprodutível, `FINTWIN_ML_EVAL_PERSIST=1` regista o resultado em `MlEvaluationRun`. Operações devem agendar `pnpm ml:retention` pelo menos diariamente para eliminar os excertos cujo prazo terminou; hashes e métricas não reversíveis permanecem para auditoria.

## Limites, kill switch e fallback

`runGovernedMl` aplica consentimento e preferência de IA local, `FINTWIN_ML_KILL_SWITCH`, controlo por capacidade em `MlFeatureControl`, bloqueio de sinais de prompt injection, limites de entrada e timeout, fallback seguro e telemetria best-effort. Administradores podem ativar, desativar ou acionar o kill switch no Backoffice; cada alteração gera um evento no ledger append-only.

## Drift

Cobertura, confiança e taxa de correção são comparadas entre janelas de 30 dias. Não se declara drift com menos de 20 amostras por janela. O Backoffice mostra `STABLE`, `WATCH`, `DRIFT` ou `INSUFFICIENT_DATA`; o diagnóstico nunca muda dados nem modelos automaticamente.

## Capacidades financeiras

- Normalização de comerciantes e categorização: regras confirmadas prevalecem; sugestão exige confirmação.
- Anomalias: regras explicáveis e evidência observável; não se chama “fraude”.
- P10/P50/P90: bandas estatísticas sobre fluxos mensais reais; não são garantias.
- Risco de liquidez: classificação explicável a partir do P10, saldo e saídas conhecidas.
- Document intelligence: extração de comprovativos; nunca cria movimentos sem confirmação.
- Poupança explicável: sugere um limite conservador, sem transferir dinheiro.
- Copiloto de reconciliação: ordena candidatos e explica montante/data/descrição; o utilizador confirma.
- Assistente financeiro: o modelo só interpreta a intenção; ferramentas read-only calculam a resposta.

## Fora de âmbito

Fraude formal, AML, credit scoring, robo-advice e execução de investimentos permanecem bloqueados. Exigem enquadramento jurídico, validação independente, datasets representativos, monitorização específica e responsabilidade humana formal.
