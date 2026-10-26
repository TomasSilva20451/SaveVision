# Funcionalidades financeiras corporativas

Ordem funcional de referência:

1. Open Banking read-only — `/open-banking`, contrato `OpenBankingProvider`.
2. Reconciliação — `/reconciliacao` (`docs/BANK_RECONCILIATION.md`).
3. Duplicados — deteção no extrato + matching recibo/despesa existente.
4. Centro de Segurança — `/perfil/seguranca`.
5. Centro de Privacidade — `/perfil/privacidade`.
6. Auditoria pesquisável — `/empresa/auditoria` (owners).
7. RBAC — `src/lib/corporate/rbac.ts` sobre `WorkspaceRole`.
8. Maker-checker — `/empresa/aprovacoes`, modelo `FinancialApproval`.
9. Tesouraria — `/empresa/tesouraria` (previsões + baseline de simulação + KPIs de reconciliação); detalhe em `/previsoes` e `/simulacoes`.
10. Exportação ERP — `/api/reports/accounting-csv`.
11. Webhooks — `/empresa/webhooks` (registo; entrega assíncrona futura).
12. Casos — `/empresa/casos`.

Toda a informação financeira permanece isolada por `workspaceId`.
