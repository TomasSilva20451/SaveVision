# Reconciliação bancária

A reconciliação cruza **linhas de extrato** (`BankFeedLine`) com **movimentos do ledger** (`Transaction`).

## Importação

- Open Banking read-only (`OpenBankingConsent`) ou CSV em `/reconciliacao`.
- Formato CSV: `data,montante,descricao` (separador `,` ou `;`).
- Duplicados no extrato são marcados com `DUPLICATE` (mesma data civil, montante e hash de contraparte).

## Motor

- `src/lib/finance/bank-reconciliation.ts`: tolerância de montante `0.01`, janela de ±2 dias civis (`Europe/Lisbon`), confiança mínima 85% para auto-match.
- Auto-match nunca associa a mesma transação duas vezes na mesma execução.

## Auditoria

- Importação, auto-run e match manual geram eventos no ledger `AuditEvent`.

## ERP

- Exportação contabilística: `GET /api/reports/accounting-csv` (owners), colunas SNC simplificadas.

## Webhooks

- Eventos: `reconciliation.matched`, `bank_feed.imported`.
- Cabeçalhos: `X-FinTwin-Signature` (HMAC-SHA256 de `{timestamp}.{body}`), `X-FinTwin-Timestamp`, `X-FinTwin-Event`.
- Segredo guardado cifrado (`secretEnc`); mostrado uma vez na criação.

## E2E

- `e2e/14-bank-reconciliation.spec.ts`: despesa + CSV + auto-match; tesouraria empresarial.
