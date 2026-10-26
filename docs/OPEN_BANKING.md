# Open Banking (read-only)

- Consentimentos em `OpenBankingConsent`: scopes predefinidos `accounts:read` e `transactions:read`, flag `readOnly=true`.
- UI: `/open-banking`. Integração TPP real implementa `OpenBankingProvider` em `src/server/providers/contracts.ts`.
- Fallback operacional: importação CSV na reconciliação (`manual-bank-feed`).
- Providers: `sandbox-open-banking` (demo/E2E), `http-open-banking` quando `FINTWIN_OPEN_BANKING_BASE_URL` está definido (Bearer = `consentRef`).
- Sincronização: botão «Sincronizar extrato» em `/open-banking` → `syncOpenBankingFeed`.

Nunca iniciar pagamentos ou alterar saldos via API bancária nesta versão.
