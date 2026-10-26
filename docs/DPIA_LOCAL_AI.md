# DPIA — IA local (Ollama)

Data: 2026-10-24 · Responsável: titulares FinTwin (Tomás / Telmo)

## Descrição do tratamento

Processamento **local** via Ollama para: categorização de transações, deteção de recorrências, ajuda contextual, assistente read-only, narrativas de relatório, explicação de alertas, leitura de recibos (visão).

## Necessidade e proporcionalidade

- Alternativa sempre disponível: entrada manual e motores determinísticos.
- Dados minimizados (sem IDs de conta, saldos agregados só no assistente conforme `FINANCIAL_ASSISTANT.md`).
- Remote Ollama bloqueado salvo `OLLAMA_ALLOW_REMOTE=1`.

## Riscos

| Risco | Gravidade | Mitigação |
|-------|-----------|-----------|
| Fuga para modelo cloud | Alta | Sem integração cloud; URL localhost |
| Prompt injection | Média | Read-only tools; sem SQL autónomo |
| Recibos sensíveis na visão | Média | Consentimento; disco privado |
| Retenção excessiva prompts | Baixa | `storePrompts` off; retenção 7 dias |

## Decisão

Tratamento **aceitável** com consentimento explícito (`local_ai_processing`) e DPIA revisto quando novos fluxos enviarem PII ao modelo.

## Revisão

Anual ou quando mudar modelo/fluxo de recibos/assistente.

## Governação transversal (2026-10)

Ver `docs/ML_GOVERNANCE.md`, `docs/ML_FEATURE_ROADMAP.md`, eval `pnpm ml:eval`, retenção `pnpm ml:retention`, kill switch no Backoffice. Capacidades de alto risco (fraude, AML, crédito, robo-advice) permanecem **fora de âmbito**.
