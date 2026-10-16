# Modelo patrimonial (FinTwin)

## Definição

Património líquido = saldos de contas incluídas no património + investimentos **STANDALONE** − passivos manuais (`FinancialLiability`).

## Investimentos

| Modo | Comportamento |
|------|----------------|
| `STANDALONE` | Valor de mercado manual (`quantity × manualPrice`) soma ao património. |
| `ACCOUNT_COMPONENT` | Posição ligada a `linkedAccountId`; **não** soma separadamente (evita dupla contabilização com saldo da conta). |

Validação: `linkedAccountId` tem de pertencer ao mesmo `workspaceId`.

## Objetivos de poupança

Não são ativos. Apenas registam intenção e contribuições; não aumentam património por si.

## Passivos

`outstandingBalance` reduz património. Pagamentos com banco (`WITH_BANK`): capital → transação `ADJUSTMENT` (saída de caixa, não despesa KPI); juros e encargos → `EXPENSE`. Ver `docs/FINANCIAL_RULES.md` para o cenário 2000 € / 10 000 € / 500 €.

## Histórico

`NetWorthSnapshot` regista totais explícitos no momento da captura. Não se inferem valores anteriores à existência de snapshots.
