# Roadmap de inteligência financeira (FinTwin)

| Etapa | Objetivo | Prioridade |
|-------|----------|------------|
| 16.1 | Integridade, segurança, idempotência, recuperação | Crítica — concluída |
| **17a** | Despesas recorrentes + calendário + confirmação idempotente | Alta — em curso |
| **17b** | Previsões de tesouraria determinísticas (receitas + despesas previstas) | Alta — após 17a |
| **18** | Padrões, anomalias e recomendações explicáveis (sem ML obrigatório) | Alta — após 17b |
| **19** | ML opcional, só com dados e benefício demonstrável | Condicional |

Não confundir previsões com certezas. ML não substitui integridade dos movimentos.

## Espelho arquitetural

Despesas recorrentes seguem o padrão `IncomeSeries` / `IncomeOccurrence`: ocorrências `EXPECTED` **não** alteram saldo; confirmação cria uma transação `EXPENSE` `COMPLETED`.

## Indicadores (17a)

- **Resultado económico:** receitas realizadas − despesas realizadas (`calculateCashFlow` — renomear na UI).
- **Movimento de caixa:** entradas e saídas efectivas (`calculateNetCashMovement`, inclui amortização `ADJUSTMENT`).
- **Variação patrimonial:** modelo patrimonial existente.
