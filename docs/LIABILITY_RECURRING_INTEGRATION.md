# Integração passivos ↔ recorrências (17c.1)

## Campos

| Campo | Modelo | UI |
|-------|--------|-----|
| `paymentDueDayOfMonth` | `FinancialLiability` | `/patrimonio` |
| `linkedLiabilityId` | `RecurringExpense` | `/despesas-recorrentes` |

## Previsão (fonte autoritativa)

- Recorrência **ACTIVE** com `linkedLiabilityId` → passivo **não** gera eventos extra.
- Recorrência **PAUSED** / **ENDED** → passivo pode voltar à projeção se tiver `paymentDueDayOfMonth`.
- Sem associação → passivo só entra com `monthlyPayment` **e** `paymentDueDayOfMonth`.

## Vencimento dia 29–31

Meses curtos usam o **último dia válido** (motor `advanceMonthly` / clamp).

## Confirmação de pagamentos

A associação serve **previsão**. Confirmar recorrência e registar pagamento de passivo com movimento bancário continuam fluxos **separados** — evitar duplicar saídas manualmente.

## Inconsistências

Montantes ou periodicidades diferentes → aviso em `/previsoes` (`configurationWarnings`).

Um passivo: no máximo **uma** recorrência ACTIVE associada.
