# Roadmap

Cada fase fecha com `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`.

1. Base — concluída: Next.js, PostgreSQL, Prisma, EUR e datas de Lisboa.
2. Autenticação com Argon2id — concluída: login, logout, cookie HttpOnly e limite de tentativas. Centro de segurança em `/perfil/seguranca` (`docs/SECURITY_CENTER.md`): email, TOTP, códigos de recuperação, passkeys, sessões revogáveis, limites por conta/IP/dispositivo e confirmação reforçada.
3. Workspaces e autorização no servidor — concluída: pessoais no seed, switcher e guards.
4. Contas, transações e motor decimal — concluída: `/contas`, `/transacoes`, transferências; receitas/despesas na Fase 5.
5. Receitas, familiar, e-commerce, ténis e despesas — concluída: `/receitas`, `/despesas`.
6. Dashboard, KPIs e gráficos — concluída: `/dashboard`.
7. Poupança, objetivos, score e simulador — concluída: `/planeamento`.
8. Conta conjunta por convite — concluída: `/conta-conjunta`.
9. Relatórios PDF/CSV, documentos e importação — concluída: `/relatorios`.
10. Investimentos educativos e cripto manual — concluída: `/investimentos`.
11. Previsões e insights determinísticos — concluída: `/previsoes`.
12. Seed, testes de ponta a ponta e verificação no browser — concluída: `pnpm test:e2e`, seed alargado.
13. Auditoria, segurança e estabilização — concluída: isolamento João/Maria, relatórios completos, E2E alargado, `docs/SECURITY_AUDIT.md`.
14. Experiência de utilização e design — concluída: primitivos UI, mobile, flash, dashboard/despesas (`docs/PROGRESS.md`).
15. Orçamentos, património e planeamento avançado — concluída: `/orcamentos`, `/patrimonio`, análise de despesas, passivos manuais, KPIs no dashboard, testes financeiros e E2E alargados.
16. Integridade patrimonial e fiabilidade — concluída: E2E com `storageState`, pagamentos de passivo atómicos, idempotência, snapshots, constraints SQL, audit parcial, backup/restore.
16.1. Consolidação integridade e segurança — concluída: testes WITH_BANK, idempotência transacional e concorrência, isolamento ampliado, restore guard.
17a. Despesas recorrentes determinísticas — concluída: `/despesas-recorrentes`, calendário, confirmação idempotente, anulação auditada de pagamentos e preferência segura por conta à ordem (`docs/RECURRING_EXPENSES.md`).
17a.1. Estabilização E2E recorrências — concluída: `anchorDate`, global-setup, Playwright CI (`docs/TESTING.md`).
17b. Previsões de tesouraria (determinísticas) — **concluída** (motor, `/previsoes`, E2E 08).
17b.1. Consolidação (E2E fail-closed, passivos monthlyPayment, UI, build) — **concluída**.
17c. Análises financeiras (`/analises`) — **concluída**.
17c.1. UI passivos ↔ recorrências (previsões) — **concluída**.
18. Alertas financeiros persistentes e priorizados — **concluída** (`/alertas`, `docs/FINANCIAL_ALERTS.md`).
19. Planeamento avançado e simulação de decisões — **concluída** (`/simulacoes`, `docs/FINANCIAL_SIMULATIONS.md`).
20. ML opcional — **concluída (subfases formulário + recorrências)**: categorização local Ollama no registo de transações; deteção híbrida de possíveis despesas recorrentes em `/despesas-recorrentes` com confirmação humana.
20.2. Revisão em lote de categorias — **concluída**: fila em `/transacoes?review=1`, `TransactionCategorizationSuggestion`, batch determinístico + Ollama opcional (`docs/LOCAL_ML_CATEGORIZATION.md`).
20.3. Assistente financeiro read-only — **concluída**: `/assistente` (`docs/FINANCIAL_ASSISTANT.md`).
20.4. Matching recibo ↔ despesa — **concluída**: heurística + confirmação duplicado (`docs/RECEIPT_SCAN.md`).
20.5. Resumo narrativo no PDF/CSV — **concluída** (`docs/MONTHLY_REPORT_NARRATIVE.md`).
20.6. Explicar esta página — **concluída** (`docs/CONTEXTUAL_HELP.md`).
20.7. Anomalias explicáveis v2 — **concluída**: motor unificado, insights, alertas, factos mensais (`docs/FINANCIAL_INSIGHTS.md`).
21. Operacionalização reproduzível — **concluída**: fontes locais, ambientes e bases fail-closed, seed apenas demo/E2E, teste de isolamento autocontido, artefacto standalone único, staging/produção equivalentes e CI/release bloqueados pelo portão completo.
22. Continuidade e backups — **concluída**: política 3-2-1, RPO/RTO, backups cifrados e off-site (`pnpm db:backup:run`), PITR de referência, drill trimestral (CI + `pnpm db:backup:drill`), runbooks PostgreSQL/Ollama/armazenamento (`docs/BUSINESS_CONTINUITY.md`).
23. Observabilidade e IR — **concluída**: logs JSON, métricas Prometheus (`/api/metrics`), OTEL opcional, middleware trace, SLOs (`docs/SLO.md`), plano de incidentes, SIEM (Vector example), alertas `pnpm ops:alert-check` (`docs/OBSERVABILITY.md`, `docs/INCIDENT_RESPONSE.md`).
24. Privacidade e governação — **concluída**: inventário, classificação, consentimentos versionados, retenção, exportação titular, eliminação verificável, DPIA IA local, Centro de Privacidade `/perfil/privacidade` (`docs/PRIVACY_GOVERNANCE.md`, `docs/OLLAMA_PRIVACY.md`).
25. Segurança app e supply chain — **concluída**: ASVS L2 baseline, threat model, CodeQL/gitleaks/audit, SBOM CycloneDX, Cosign, Dependabot, CSP/HSTS/Permissions-Policy, scan malware uploads, pentest readiness (`docs/SUPPLY_CHAIN_SECURITY.md`).
26. Egressos, cifra e auditoria forense — **concluída**: segredos por ficheiro (`*_FILE`), TLS fail-closed, chaves por ambiente, documentos `FTENC01`, backups `FTBACK01`, ledger `AuditEvent` encadeado e assinado, arquivo JSONL independente, triggers anti-adulteração, health 503 + runbook (`docs/SECURITY_AUDIT.md`, `docs/runbooks/audit-ledger-incident.md`).
27. Plataforma empresarial — **implementada no monólito** (portão CI em Node 24): IaC de referência (`infra/terraform`), PostgreSQL Multi-AZ e bucket privado por ambiente, fila `PlatformJob` com limites de concorrência, rollout que falha fechado (`scripts/deploy-rollout.mjs`), capacidade em `recommendReplicas`, backoffice `SUPPORT`/`ADMIN` sem dados financeiros (`docs/ENTERPRISE_PLATFORM.md`).
28. Finanças corporativas — **implementada**: reconciliação bancária (CSV + motor), consentimentos Open Banking read-only, auditoria pesquisável, RBAC corporativo, maker-checker, exportação contabilística, webhooks e casos (`docs/CORPORATE_FINANCE.md`, `docs/BANK_RECONCILIATION.md`).
**Prioridade operacional (relatório lacunas 10/10 v2.0):** fechar R1–R7 antes de go-live externo — plano fases 29a–36 em `docs/GAP_CLOSURE_PLAN.md` (integridade documentos, rate limit Redis, staging/KMS, carga/failover, pentest/DAST, WORM/SIEM).

29. Governação e inteligência financeira — **implementada, portão em validação**: registo de modelos/prompts, telemetria com retenção consentida, limites, kill switches auditados, golden datasets pt-PT, red-team, avaliação obrigatória em CI, drift e fallbacks. Inclui comerciante normalizado, anomalias explicáveis, P10/P50/P90, risco de liquidez, document intelligence existente, poupança explicável, copiloto de reconciliação e assistente read-only (`/inteligencia`, `docs/ML_GOVERNANCE.md`). Fraude, AML, credit scoring e robo-advice permanecem fora de âmbito.

Machine learning e Open Banking real ficam atrás dos contratos em `src/server/providers/contracts.ts`.
