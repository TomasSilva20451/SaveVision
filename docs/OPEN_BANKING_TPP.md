# Open Banking — TPP real (PDF §8)

Read-only. Sem iniciação de pagamentos.

## Adaptadores

| Provider | Env | Lifecycle |
|----------|-----|-----------|
| `sandbox-open-banking` | demo/E2E | refresh/revoke simulados |
| `http-open-banking` | staging/prod | `FINTWIN_OPEN_BANKING_BASE_URL`, `FINTWIN_OPEN_BANKING_API_KEY` |

Endpoints HTTP esperados (adaptador):

- `GET /accounts/{ref}/transactions?from=&to=` — Bearer = `consentRef`
- `POST /consents/{ref}/refresh` — prolongar consentimento (SCA no agregador)
- `DELETE /consents/{ref}` — revogar

## Consentimento na app

Registo manual em `/open-banking` ou sync via `syncOpenBankingFeed`. Estado em `OpenBankingConsent`.

## Próximos passos regulatório

- Certificação QWAC/eIDAS conforme jurisdição
- Redirect OAuth2 + SCA no browser do titular
- Webhooks do agregador para `consent.expired`

Ver também `docs/OPEN_BANKING.md` e `docs/CORPORATE_FINANCE.md`.
