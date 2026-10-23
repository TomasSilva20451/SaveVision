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

## Deteção híbrida de padrões (Fase 20.1)

- Motor em `src/lib/finance/recurring-pattern-detection.ts` (intervalos, montantes, confiança, exclusão de retalho).
- Enriquecimento opcional via Ollama local; sugestões em `/despesas-recorrentes` com evidência e confirmação explícita.
- Ignorar sugestão ou bloquear comerciante por workspace; nunca cria `RecurringExpense` automaticamente.

## Idempotência

Confirmação com `idempotencyKey` única por workspace; retry seguro; conflito de payload rejeitado.

## Alteração de valor

Atualiza série e ocorrências futuras `EXPECTED`/`POSTPONED` não personalizadas; histórico `PAID` intacto.

## Conta de pagamento e anulação

- Sem uma conta explicitamente associada à recorrência, a interface escolhe primeiro uma conta `CURRENT`, depois `CASH`; `SAVINGS` fica no fim e é identificada como uma escolha a evitar para pagamentos.
- Uma conta explicitamente configurada na recorrência continua a ser respeitada.
- Anular um pagamento faz soft-delete apenas da `Transaction` criada pela confirmação, limpa a ligação idempotente e devolve a ocorrência a `EXPECTED` ou `POSTPONED`.
- Como o saldo é calculado pelo ledger e ignora movimentos com `deletedAt`, o montante regressa automaticamente à conta originalmente debitada.
- A reversão é registada em `FinancialAuditLog` como `EXPENSE_OCCURRENCE_PAYMENT_REVERSED`.

## Previsões (17b)

O serviço `collectTreasuryForecastEvents` lê ocorrências `EXPECTED`/`POSTPONED` directamente (sem duplicar motor de agenda). Ocorrências `PAID`/`SKIPPED` ficam de fora. Ver `docs/FINANCIAL_RULES.md` (secção 17b).
