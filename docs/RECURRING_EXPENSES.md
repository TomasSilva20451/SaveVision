# Despesas recorrentes (Fase 17a)

## Modelo

- `RecurringExpense` — definição (periodicidade, valor previsto, categoria, conta opcional).
- `RecurringExpenseOccurrence` — vencimento concreto (`EXPECTED`, `PAID`, `SKIPPED`, `POSTPONED`).

Espelha o padrão `IncomeSeries` / `IncomeOccurrence`.

## Regra financeira

**Despesa prevista ≠ despesa paga.** Só a confirmação cria `Transaction` `EXPENSE` `COMPLETED`.

## Periodicidade

Motor determinístico em `src/lib/finance/recurring-schedule.ts`:

- Dia 31 → último dia válido do mês.
- Anual 29/fev → 28/fev em anos não bissextos.
- Horizonte: até 48 ocorrências / ~18 meses.

## Idempotência

Confirmação com `idempotencyKey` única por workspace; retry seguro; conflito de payload rejeitado.

## Alteração de valor

Atualiza série e ocorrências futuras `EXPECTED`/`POSTPONED` não personalizadas; histórico `PAID` intacto.

## Previsões (17b)

O serviço `collectTreasuryForecastEvents` lê ocorrências `EXPECTED`/`POSTPONED` directamente (sem duplicar motor de agenda). Ocorrências `PAID`/`SKIPPED` ficam de fora. Ver `docs/FINANCIAL_RULES.md` (secção 17b).
