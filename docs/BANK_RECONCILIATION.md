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

## Excepções e fecho diário

- Linhas `UNMATCHED` podem passar a `EXCEPTION` (fila de divergências) sem apagar o extrato.
- **Fecho diário** (`ReconciliationDayClose`): regista `% auto-match`, pendentes e excepções por dia civil; acção em `/reconciliacao`.

## Webhooks

- Eventos: `reconciliation.matched`, `bank_feed.imported`.
- Entrega assíncrona via `PlatformJob` (`WEBHOOK_DELIVERY`) quando `FINTWIN_WEBHOOKS_ASYNC=1` (omissão).
- Cabeçalhos: `X-FinTwin-Signature` (HMAC-SHA256 de `{timestamp}.{body}`), `X-FinTwin-Timestamp`, `X-FinTwin-Event`, `X-FinTwin-Delivery-Id`.
- Segredo guardado cifrado (`secretEnc`); mostrado uma vez na criação.

## E2E

- `e2e/14-bank-reconciliation.spec.ts`: despesa + CSV + auto-match; tesouraria empresarial.
