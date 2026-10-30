# Progresso FinTwin

## Plano de Poupança — Desafio 300 € (2026-10-29)

- Branch `codex/savings-plan-300`: modelos Prisma (`SavingsPlan*`), migração `20261028220000_savings_plan`, motor `savings-plan-engine.ts`, activação atómica/idempotente, wizard `/planeamento`, detalhe `/planeamento/plano-poupanca/[id]`, cartão dashboard, alertas `SAVINGS_PLAN_*`.
- **Concluído (portão local):** isolamento E2E (`fintwin_e2e` forçado), testes integração `savings-plan.integration.test.ts`, revisão semanal UI, secção PDF/CSV, pré-visualização wizard, E2E `15-savings-plan.spec.ts` + suite 97/97.
- **Pós-merge (2026-10-30):** `main` verde (Quality, Security, Release); Vercel Production em `af0b2dd`+; Desafio 300 € activo para Tomás na Neon ligada ao deploy; E2E/CI isolamento planos integração.

## Go-live evidence pack — Fases H–L (2026-10-26)

- **Perfil predefinido (zero-cost):** [`docs/GO_LIVE_ZERO_COST.md`](GO_LIVE_ZERO_COST.md), `compose.staging-free.yml` (Postgres + Redis OSS + 2 apps), tunnel HTTPS grátis, AppSec via ZAP/CodeQL (sem pentest pago).
- **Fase H (staging Path B):** `pnpm infra:staging-apply` (AWS opcional), workflow `.github/workflows/staging-apply.yml`, Redis em `compose.deploy.yml`.
- **Fase I (§13):** `pnpm golive:evidence` → `storage/evidence/golive-*` + `manifest.json`; drill R1 `pnpm security:rate-limit-drill`.
- **Fase J (pentest):** brief/tracker actualizados; `pnpm security:pentest-cycle`; DAST contínuo via `dast-staging.yml` (execução externa + reteste pendente de fornecedor).
- **Fase K (R8 CSP):** nonce por pedido em `src/proxy.ts` + testes `security-headers.test.ts`; ASVS actualizado.
- **Fase L:** portão completo na secção «Portão» abaixo quando `main` verde.

## Sprints E–G — Resiliência, WORM/SIEM, corporativo (2026-10-26)

- **Sprint E (R6):** k6 smoke (`tests/load/smoke.js`), CI `load-smoke.yml`, `pnpm game-day:drill`, runbooks failover/rotação chaves.
- **Sprint F (R5):** bucket audit WORM (`audit_worm.tf`), `pnpm audit:worm:sync`, SIEM via `FINTWIN_SIEM_HTTP_ENDPOINT`, `docs/WORM_SIEM.md`.
- **Sprint G:** fecho diário + excepções reconciliação; webhooks assíncronos (`WEBHOOK_DELIVERY`); TPP refresh/revoke HTTP; `/inteligencia` bloqueada sem eval ML recente.

## Sprints C + D — DAST staging e Terraform KMS (2026-10-25)

- **Sprint C (R3):** workflow `dast-staging.yml` (cron + manual), baseline `security/baseline/dast-high-alerts.json`, `scripts/dast-compare-baseline.mjs`, checklist em `PENTEST_READINESS.md`.
- **Sprint D (R2/R4):** Terraform KMS + Secrets Manager + Redis staging (`infra/terraform/*`), outputs, `docs/STAGING_KMS.md`, CI `terraform-staging-plan.yml`, `pnpm infra:render-staging-secrets`.

## Rate limit distribuído — Fase 30 / R1 (2026-10-25)

- Store Redis (`ioredis`) + fallback PostgreSQL `RateLimitCounter`; buckets de login também em Redis quando disponível.
- Política em `api-rate-limit-policy.ts`; rotas `/api/reports/*`, documentos, exportações titular e métricas.
- Env: `FINTWIN_REDIS_URL`, `FINTWIN_RATE_LIMIT_BACKEND=redis|postgres`, `FINTWIN_DISABLE_API_RATE_LIMIT=1` (dev).

## Integridade de documentos — Fase 29a / R7 (2026-10-25)

- Campos `integrityStatus` / `integrityReason` em `StoredDocument`; motor `document-integrity.ts`.
- Download devolve **410** em quarentena; scan na UI `/empresa/auditoria` (owners).
- CLI: `pnpm documents:integrity:check` (dry-run) e `pnpm documents:integrity:repair` (`--apply`).
- `/api/health` expõe `unavailableDocuments`; `ops:alert-check` alerta se > 0.

## Governação ML formalizada — Fase 36 / R9 (2026-10-26)

- Registo LLM (`registry.ts`), advisory determinístico (`advisory-registry.ts`), manifest de prompts (`ml/prompts/manifest.json`).
- Eval **1.1.0**: golden comerciantes, red-team, advisory probabilístico, validação de manifest; gate `isAdvisoryReleaseAllowed`.
- Backoffice: drift, kill switch, lista advisory e capacidades bloqueadas (`DEFERRED_HIGH_RISK_ML`).
- Roadmap produto §11 documentado em `docs/ML_FEATURE_ROADMAP.md`.

## Governação ML e inteligência financeira — Fase 29 (2026-10-25)

- Catálogo fechado e versionado em `src/lib/ml/registry.ts`, com modelo, prompt, finalidade, limites, fallback e revisão humana por capacidade.
- `MlFeatureControl`, `MlInvocationEvent`, `MlEvaluationRun` e `MlDriftSnapshot` suportam kill switch, telemetria sem dados financeiros em claro, avaliações de release e diagnóstico de drift.
- `runGovernedMl` impõe consentimento, limites de tokens/latência, red-team de prompt injection, retenção de prompts por sete dias apenas com consentimento e fallback seguro. Categorização e assistente já passam por este executor.
- `pnpm ml:eval` usa golden dataset e red-team pt-PT e integra o portão local e reprodutível de CI.
- Nova área `/inteligencia`: cenários P10/P50/P90, risco de falta de liquidez e poupança explicável, calculados com `Decimal`, sem escritas.
- A reconciliação destaca candidatos e razões, mas mantém confirmação humana. O assistente ganhou intenções read-only para cenários, liquidez, poupança e estado da reconciliação.
- O Backoffice apresenta métricas, drift e controlos de emergência; alterações ficam no ledger auditável.
- Fraude formal, AML, credit scoring, robo-advice e execução de investimentos continuam explicitamente bloqueados.
- Estado: implementação concluída; portão completo ainda por executar nesta alteração.

## Finanças corporativas — Fase 28 (2026-10-25)

- Modelos Prisma: `BankFeedLine`, `BankReconciliationMatch`, `OpenBankingConsent`, `FinancialApproval`, `WebhookSubscription`, `SupportCase`.
- Reconciliação: import CSV, auto-match determinístico, confirmação manual, KPIs em `/reconciliacao`.
- Open Banking: registry (`sandbox-open-banking`, `http-open-banking`), sync de extrato, consentimentos em `/open-banking`.
- Webhooks HMAC após match/import; `secretEnc` cifrado.
- Tesouraria empresarial `/empresa/tesouraria`; E2E `14-bank-reconciliation.spec.ts`.
- Corporativo: auditoria, aprovações, webhooks, casos; export ERP `/api/reports/accounting-csv`.

## Plataforma empresarial — Fase 27 (2026-10-24)

- Fila `PlatformJob` para relatórios, OCR e categorização, com tecto global e por tipo. `pnpm jobs:work` reclama e valida o payload; os ecrãs síncronos atuais mantêm-se.
- Documentos continuam cifrados. `FINTWIN_OBJECT_STORAGE=s3` envia o envelope para um bucket privado `fintwin-<ambiente>-*`.
- Terraform de referência: RDS PostgreSQL com Multi-AZ em produção e bucket sem acesso público. Não é aplicado pelo CI.
- Deploy gradual: workflow manual que promove só se `/api/health` responder; caso contrário indica a imagem anterior.
- Backoffice `/backoffice`: `SUPPORT` lista a fila; `ADMIN` repõe falhas. Nenhum dos dois lê movimentos ou ficheiros.

## Egressos, cifra e auditoria — Fase 26 (2026-10-24)

- Segredos resolvidos em memória (`secret-files.mjs`, `runtime-entrypoint.mjs`); política `environment-policy` bloqueia HTTP, PostgreSQL sem TLS e chaves sem prefixo de ambiente.
- Documentos com envelope autenticado; backups e arquivo de auditoria no formato `FTBACK01`; volume `storage/audit/<ambiente>/` separado em `compose.deploy.yml`.
- Ledger global `appendAuditEvent`: lock PostgreSQL, hash chain + HMAC, espelho JSONL; logins/exportações/eliminações via `recordSecurityEvent`; financeiro via `writeFinancialAuditLog`.
- Triggers append-only; `/api/health` degrada com tentativas de adulteração; verificação `pnpm audit:verify`.
- Portão: lint, typecheck, testes (incl. `audit-chain`), build `--webpack`, E2E 87/87 (base `fintwin_e2e`).

## Segurança e supply chain — Fase 25 (2026-10-24)

- Headers CSP, HSTS, Permissions-Policy; scan malware uploads (EICAR/PE + ClamAV opcional).
- CI: `security-supply-chain.yml` (audit, gitleaks, CodeQL, SBOM, ZAP manual), Dependabot, Cosign no release.
- Docs: `OWASP_ASVS_L2.md`, `THREAT_MODEL.md`, `SUPPLY_CHAIN_SECURITY.md`, `PENTEST_READINESS.md`.

## Privacidade e governação — Fase 24 (2026-10-24)

- Centro de Privacidade `/perfil/privacidade`: consentimentos, retenção, export JSON, eliminação verificável (`PrivacyConsent`, `SubjectErasureRequest`).
- `GET /api/privacy/export`; governação Ollama ligada a consentimentos em `/perfil/ia`.
- Docs: `DATA_INVENTORY.md`, `PRIVACY_GOVERNANCE.md`, `DPIA_LOCAL_AI.md`, `OLLAMA_PRIVACY.md`.

## Observabilidade e resposta a incidentes — Fase 23 (2026-10-23)

- Logs estruturados (Node + edge `http_access`), métricas login/HTTP/transacções/jobs, `/api/metrics`.
- OpenTelemetry OTLP (`FINTWIN_OTEL_ENABLED=1`), tracing W3C no middleware.
- SLOs por jornada, plano IR, severidades, game days, post-mortems (`docs/INCIDENT_RESPONSE.md`).
- SIEM: exemplo Vector (`infra/siem/vector.toml.example`); alertas `pnpm ops:alert-check`.

## Continuidade e backups — Fase 22 (2026-10-23)

- Política **3-2-1**, **RPO/RTO** e checklist pré-clientes: `docs/BUSINESS_CONTINUITY.md`.
- `pnpm db:backup:run` (cifra AES-256-GCM, manifesto SHA-256, tarball documentos, off-site, retenção).
- PITR de referência: `docker-compose.pitr.yml`, `pnpm db:pitr:base`.
- Drill trimestral: `pnpm db:backup:drill` + workflow `.github/workflows/backup-restore-drill.yml`.
- Runbooks: `docs/runbooks/` (PostgreSQL, Ollama, armazenamento, incidentes backup).

## Identidade e centro de segurança (2026-10-21)

- Verificação de email, TOTP, códigos de recuperação, passkeys, sessões revogáveis, limites por conta/IP/dispositivo e confirmação reforçada.
- Envio SMTP genérico (verificação, alteração de email, recuperação) e alertas financeiros por email (CRITICAL/HIGH + `SAVINGS_PLAN_*`) após sync.
- UI em `/perfil/seguranca`, `/verificar-email` e `/recuperar-conta`. Exportação em `GET /api/account/export`. E2E TOTP: `e2e/16-security-totp.spec.ts`.
- Detalhe em `docs/SECURITY_CENTER.md` e `docs/FINANCIAL_ALERTS.md` (notificações).

## Fases 20.2–20.7 — ML local de alto valor (2026-10-21)

- Normalização de comerciante partilhada (`merchant-normalization.ts`) integrada em categorização e recibos.
- Revisão em lote: modelo `TransactionCategorizationSuggestion`, serviço batch, UI `/transacoes?review=1`.
- Recibos: matching heurístico de duplicados + confirmação obrigatória no drawer.
- PDF/CSV: narrativa mensal opcional (`includeNarrative`) alinhada ao `periodKey` civil.
- Ajuda contextual: «Explicar esta página» (one-shot).
- Anomalias v2: motor unificado; insights, alertas e factos mensais alinhados.
- Portão: lint, typecheck, 231 testes Vitest, build e 87/87 Playwright (após `scripts/db-e2e-setup.sh` para migrações novas).

## Fase 20.2 — assistente financeiro local (2026-10-21)

- UI `/assistente` (nav «Mais»): chat simples com exemplos, evidências e links para filtros existentes.
- Ollama (`qwen3.5:4b-mlx`) devolve apenas JSON de intent; execução e resolução de categorias ficam no servidor (`financial-assistant-intents`, `financial-assistant-tools`).
- Sete intenções MVP: totais por categoria, tendências, taxa de poupança, pagamentos próximos, gap de fundo de emergência, conta com maior saldo, viabilidade de poupar X €/mês.
- Documentação em `docs/FINANCIAL_ASSISTANT.md`; testes Vitest com provider mockado.

## Fase 20.3 — explicação de alertas e padrões (2026-10-21)

- Evidência estruturada (`evidence` do alerta ou insight) → payload → Ollama local ou texto determinístico.
- `/alertas`: «Explicar alerta»; `/analises`: «Explicar padrão» nos insights. Prioridade e números oficiais mantêm-se inalterados.
- Enriquecimento opcional para orçamentos: top movimentos do mês e comparação com o mês anterior (cálculo no servidor).

## Fase 20.1 — deteção de despesas recorrentes (2026-10-21)

- Motor determinístico em `src/lib/finance/recurring-pattern-detection.ts`: agrupa despesas por comerciante normalizado, exige ≥3 movimentos, intervalos 7/14/30/90/182/365 dias com tolerância, montantes dentro de 2% ou 0,50 €, confiança estatística e exclusão de retalho (supermercados).
- O Ollama (`qwen3.5:4b-mlx`) só enriquece candidatos já validados; respostas `OTHER` ou falhas **não removem** a sugestão estatística. Cache por `suggestionKey` (10 min) e concorrência máxima 2.
- Confirmação humana: o servidor reexecuta `findVerifiedRecurringPattern` com os IDs de evidência e aplica montante, frequência e datas **canónicos** da deteção (não confia em hidden fields além do nome/categoria/conta escolhidos).
- UI em `/despesas-recorrentes`: painel com evidências, confiança, formulário de confirmação, «Ignorar esta sugestão» e «Não voltar a sugerir este comerciante» (`RecurringPatternSuggestionDismissal`, `RecurringPatternMerchantBlock`).
- E2E: `auth.setup` e login estabilizados (`/login` dinâmico sem Suspense a recarregar, `DATABASE_URL` explícita no `webServer`, helper Playwright mais robusto). Os specs legados foram alinhados com drawers, menus de ações e nomes acessíveis do redesign; estados persistidos substituem esperas frágeis por flashes transitórios.
- O comando normal `pnpm test:e2e` compila e testa a aplicação com `next start` na porta isolada 3010, mantendo `fintwin_e2e` separada da aplicação da porta 3000.
- Estado: **COMPLETED** — lint e typecheck verdes, 194/194 testes Vitest, build de produção verde e 86/86 testes Playwright sem retries.

## Fase 20 — categorização local de transações (2026-10-20)

- O formulário «Nova transação» em `/transacoes` pede automaticamente uma sugestão ao `qwen3.5:4b-mlx` local depois de existirem descrição e montante; mantém também uma ação explícita para repetir.
- A resposta inclui comerciante, categoria, tipo, natureza, etiquetas, confiança e justificação. O utilizador continua a confirmar o tipo e pode alterar a categoria antes de guardar.
- O adaptador Ollama recebe apenas descrição, montante, direção, nomes/naturezas das categorias e até oito exemplos confirmados. Não recebe IDs, contas, nomes de utilizadores, saldos nem acesso à base.
- A resposta usa JSON Schema e Zod; categorias inventadas são rejeitadas no servidor. O endpoint é limitado a localhost por omissão e a falha do modelo nunca bloqueia o registo manual.
- Aceitações e correções criam uma regra isolada por workspace. Regras confirmadas têm precedência em descrições seguintes, sem fine-tuning e sem partilha entre workspaces.
- Migração `20261020143000_transaction_categorization_rules`; lint, typecheck, build e oito testes específicos verdes. O modelo real instalado respondeu ao schema fechado com a categoria permitida «Alimentação». E2E `e2e/13-transactions-ui.spec.ts` cobre o painel «Categorização local» no drawer.
- A revisão em lote de movimentos sem categoria não foi adicionada nesta subfase, evitando uma ação parcial ou um botão sem comportamento.

## Entrada decimal pt-PT (2026-10-19)

- Todos os valores financeiros passam por uma normalização decimal única que aceita vírgula ou ponto (`45,60` e `45.60`) sem usar aritmética de ponto flutuante.
- Também são aceites os formatos agrupados usuais `1.234,56`, `1,234.56` e `1 234,56`.
- Escritas diretas de contas, despesas, receitas, recorrências, objetivos, investimentos e passivos guardam o valor canónico na base de dados.
- Os campos controlados das simulações deixaram de usar `type="number"`, evitando que o navegador rejeite a vírgula antes da validação do domínio.

## Reposição pessoal e avatar local (2026-10-19)

- Criado um procedimento protegido para repor exclusivamente o workspace pessoal de um utilizador, preservando identidade e memberships conjuntos.
- O workspace pessoal de Tomás foi recriado sem contas, categorias, movimentos, recorrências, rendimentos, objetivos, investimentos, orçamentos, passivos, snapshots, alertas ou documentos.
- A fotografia indicada para Telmo foi guardada em `public/avatars/` e associada por caminho local estável; o perfil e o cabeçalho aceitam e apresentam imagens locais validadas sem depender de hotlinks temporários do Instagram.

## Fase 19 (simulações financeiras)

Estado: **COMPLETED** (após portão).

- Motor `src/lib/finance/financial-simulator.ts` + forecast `financial-simulation-forecast.ts`.
- UI `/simulacoes` com formulários reais e comparação BASE/A/B.
- Commit alertas: `03a8e4f`.

## Fase 18 (alertas financeiros)

Estado: **COMPLETED**.

- Modelos `FinancialAlert` e `FinancialAlertUserState`.
- Motor `src/lib/finance/financial-alerts.ts` + sync `src/server/services/financial-alerts.ts`.
- UI `/alertas`, secção no dashboard, contador na navegação.
- Proteção UX/servidor pagamento duplicado recorrência ↔ passivo (ack explícito).
- Ver `docs/FINANCIAL_ALERTS.md`.

## Fase 17c.1 (integração passivos ↔ recorrências)

Estado: **COMPLETED**.

- UI `paymentDueDayOfMonth` e `linkedLiabilityId`.
- Regras de previsão e avisos documentados.
- Ver `docs/LIABILITY_RECURRING_INTEGRATION.md`.

## Fase 17c

Análises em `/analises`.

## Redesign visual (em curso)

Identidade FinTech aplicada ao shell: sidebar azul-marinho, fundo claro, cartões arredondados, botões azuis, navegação alinhada às 11 referências em `docs/design-references/`.

**Dashboard v2 (2026-10-17):** KPIs horizontais (ícone à esquerda), cabeçalho compacto, gráfico com histórico/projeção, orçamento vazio sem donut fictício, passivo zero como `0,00 €`. Screenshots: `docs/visual-audit/redesign/dashboard-v2-desktop.png`, `dashboard-v2-mobile.png`.

**Contas (2026-10-17):** KPIs, evolução reconstruída, donut só com saldos positivos, tabela e transações recentes. «Adicionar conta» abre um painel com a Server Action existente. Screenshots: `docs/visual-audit/redesign/contas-after-desktop.png`.

**Orçamentos (2026-10-17):** painel com KPIs de limites, gasto só das categorias orçamentadas, despesas realizadas do mês à parte, gráficos, tabela e drawer «Novo orçamento». Objetivos e alertas de orçamento no painel lateral.

**Transações (2026-10-17):** KPIs do período filtrado (não da página de 20), gráfico diário, donut de despesas, filtros no servidor e «Nova transação» com despesa, receita e transferência. Correção de overflow das datas e drawer à direita (`dialog.side-drawer`). Screenshots: `docs/visual-audit/redesign/transacoes-filtros-desktop.png`, `transacoes-drawer-desktop.png`.

**Despesas recorrentes (2026-10-17, validação final pendente):** implementação real do redesign com header compacto, quatro KPIs contratuais, resumo previsto/pago/por pagar, evolução persistida, donut por categoria, filtros por URL, tabela funcional e drawer de criação. O cálculo mensal normaliza semanal/quinzenal/trimestral/semestral/anual com `Decimal`; operações e associação a passivo continuam nas Server Actions existentes. Flash com âmbito de rota impede mensagens de Orçamentos nesta página. Screenshots: `docs/visual-audit/redesign/despesas-recorrentes-*.png`.

**Receitas (2026-10-17, validação final pendente):** redesign integral com período mensal em pt-PT, quatro KPIs baseados em transações/ocorrências, comparação homóloga sem percentagens artificiais, evolução a seis meses, distribuição por origem, pesquisa/filtros por URL, tabela funcional, próximas receitas e drawer único para receita pontual, transferência familiar, e-commerce e ténis. Confirmação mantém a idempotência existente; datas civis são interpretadas em `Europe/Lisbon`. Screenshots: `docs/visual-audit/redesign/receitas-*.png`.

Estado da validação de Receitas: lint, typecheck e 169 testes unitários/integração verdes; build Turbopack bloqueado pelo erro ambiental `EPERM` ao abrir a porta interna do processador CSS. O E2E dirigido iniciou sem reset/seed, mas ficou bloqueado no setup porque as credenciais de João e Maria não autenticam na base `fintwin_e2e` existente; os 8 testes da aplicação não chegaram a executar.

**Alertas (2026-10-17, validação final pendente):** centro de alertas redesenhado sem sincronização na renderização. Quatro KPI distinguem prioridades ativas, eventos com vencimento nos próximos sete dias, informação e resoluções do período. A lista usa alertas persistidos, filtros/pesquisa/ordenação por URL e preserva o estado pessoal `seenAt`/`dismissedAt`. A coluna lateral apresenta donut apenas de alertas ativos, próximos vencimentos da previsão de tesouraria e calendário funcional desses eventos. O botão explícito «Atualizar alertas» e o contador pessoal da sidebar foram preservados. Screenshots: `docs/visual-audit/redesign/alertas-*.png`.

**Património (2026-10-17, validação final pendente):** redesign integral assente no modelo financeiro existente: bens são contas incluídas no património mais posições autónomas, passivos usam capital em dívida e património líquido mantém o cálculo centralizado. Quatro KPI, distribuição por categorias reais, tabelas funcionais, rácio de endividamento e drawer de ações foram alinhados à referência. A evolução e a comparação anual só aparecem quando existem snapshots persistidos suficientes; não são fabricados pontos históricos. Pagamentos continuam atómicos e idempotentes no serviço e as datas civis são convertidas em `Europe/Lisbon`. Screenshots: `docs/visual-audit/redesign/patrimonio-*.png`.

**Simulações (2026-10-18, validação final pendente):** laboratório financeiro redesenhado sobre o motor determinístico da Fase 19. O seletor apresenta apenas seis grupos suportados: poupança/objetivos, fundo de emergência, automóvel, amortização, rendimentos/despesas e despesa extraordinária integrada no forecast. Formulário, métricas e gráfico adaptam-se ao simulador; a comparação BASE/A/B usa os dados autorizados do workspace e séries calculadas pelo motor. A simulação rápida reutiliza o fundo de emergência. Não foram adicionados simuladores fictícios de casa, reforma ou investimento, nem persistência de cenários ou escritas financeiras. Screenshots: `docs/visual-audit/redesign/simulacoes-*.png`.

**Análises (2026-10-18, validação final pendente):** centro analítico redesenhado com quatro KPI calculados no servidor, filtro temporal por URL e sete separadores funcionais. A visão geral inclui evolução mensal de receitas/despesas, distribuição por categorias persistidas, taxa de poupança, categorias, execução orçamental, movimento de caixa acumulado, taxonomias separadas de origem/categoria, insights determinísticos e comparação homóloga. O rácio de essencialidade usa `Category.nature`; transferências internas e amortização de capital são excluídas pelos motores financeiros existentes. Investimentos e património não fabricam séries: mostram valores atuais ou snapshots persistidos e um estado vazio quando o histórico é insuficiente. Screenshots: `docs/visual-audit/redesign/analises-*.png`.

Estado das tarefas Análises: `analises-ui-01` a `analises-ui-26` e `analises-ui-28` implementadas; `analises-ui-27` e `analises-ui-29` ficam parciais até o portão completo. Lint, typecheck e 173 testes unitários/integração passaram. A renderização real foi validada na base `fintwin_demo_ui` em desktop e 390 px, incluindo os separadores e estados sem histórico. O build Turbopack continua bloqueado por `EPERM` ao abrir a porta interna do processador CSS. O E2E dirigido iniciou em `fintwin_e2e`, mas João e Maria permaneceram em `/login`; os 8 testes da aplicação não chegaram a executar. Não houve reset/seed da base, push ou início da Fase 20.

**Previsões (2026-10-18, validação final pendente):** painel de tesouraria redesenhado sobre o motor determinístico existente, mantendo os horizontes reais de 7, 30, 60, 90, 180 e 365 dias. Quatro KPI distinguem saldo, entradas, saídas e variação de caixa. O gráfico, fluxos mensais e saldo final reconciliam com os mesmos eventos; os meses civis parciais são identificados. Os cenários otimista e pessimista são hipóteses read-only explícitas: ajustam receitas EXPECTED e recorrências elegíveis, mantendo prestações contratuais fixas e o saldo inicial. Objetivos vêm de `SavingsGoal`, a distribuição usa categorias reais ou «Prestações e obrigações», e os insights são determinísticos. A página deixou de chamar `getPlanningOverview`, eliminando o `upsert` que ocorria na simples consulta. Screenshots: `docs/visual-audit/redesign/previsoes-*.png`.

Estado das tarefas Previsões: `previsoes-ui-01` a `previsoes-ui-25` e `previsoes-ui-27` implementadas; `previsoes-ui-26` e `previsoes-ui-28` ficam parciais até o portão completo. Lint, typecheck e 176 testes unitários/integração passaram. A renderização real foi validada em `fintwin_demo_ui` em desktop e 390 px, incluindo o estado estável sem movimentos futuros, cenários coincidentes e saídas vazias sem dados inventados. O build Turbopack continua bloqueado pelo `EPERM` ambiental ao abrir a porta interna do processador CSS. O E2E dirigido iniciou em `fintwin_e2e`, mas João e Maria permaneceram em `/login`; os 10 testes da página não chegaram a executar. Não houve reset/seed da base, push ou início da Fase 20.

Estado das tarefas Simulações: `simulacoes-ui-01` a `simulacoes-ui-20` e `simulacoes-ui-22` implementadas; `simulacoes-ui-21` e `simulacoes-ui-23` ficam parciais até o portão completo. Lint, typecheck e 169 testes unitários/integração passaram. A renderização real foi validada na base `fintwin_demo_ui` em desktop e 390 px, incluindo estados de poupança, comparação e ausência de passivos. O build Turbopack continua bloqueado por `EPERM` ao abrir a porta interna do processador CSS. O E2E dirigido iniciou em `fintwin_e2e`, mas os setups de João e Maria ficaram em `/login`; 15 testes da aplicação não chegaram a executar. A base não foi reposta nem semeada para contornar o bloqueio.

Estado das tarefas Património: `patrimonio-ui-01` a `patrimonio-ui-17` e `patrimonio-ui-19` implementadas; `patrimonio-ui-18` e `patrimonio-ui-20` ficam parciais até o portão completo. Lint, typecheck e 169 testes unitários/integração passaram. O build Turbopack continua bloqueado por `EPERM` ao abrir a porta interna do processador CSS. O E2E dirigido iniciou em `fintwin_e2e`, mas João e Maria permaneceram em `/login`; os 8 testes da aplicação não chegaram a executar. Não foram criados ativos, passivos ou snapshots fictícios; metas e componentes de conta de posições continuam excluídos conforme `docs/PATRIMONY_MODEL.md`.

Estado das tarefas Alertas: `alertas-ui-01` a `alertas-ui-16` e `alertas-ui-18` implementadas; `alertas-ui-17` e `alertas-ui-19` ficam parciais até o portão completo. Lint, typecheck e 169 testes unitários/integração passaram. O build Turbopack continua bloqueado pelo `EPERM` ambiental ao abrir a porta interna do processador CSS. O E2E dirigido iniciou em `fintwin_e2e`, mas João e Maria não autenticaram no setup; 12 testes da aplicação não chegaram a executar. Não foram criados alertas fictícios nem alteradas regras do motor da Fase 18.

Estado das tarefas do redesign de recorrências:

- `recorrentes-ui-01` a `recorrentes-ui-13`: **COMPLETED** (inspeção, header, KPIs, drawer, gráficos, tabela, filtros, vencimentos, passivos, ações, flash e mobile).
- `recorrentes-ui-14`: **PARTIAL** — lint, typecheck, testes focados e 169 testes unitários/integração passaram; build Turbopack bloqueado por `EPERM` ao abrir porta interna e E2E bloqueado na autenticação da base E2E existente (sem reset/seed por decisão de preservação).
- `recorrentes-ui-15`: **COMPLETED** — before, desktop, mobile e drawer reais guardados.
- `recorrentes-ui-16`: **BLOCKED** até o portão completo (`pnpm build` + E2E) poder ser executado no ambiente autorizado.

**Início, Despesas, Planeamento, Conta conjunta, Relatórios e Investimentos (2026-10-18, validação final pendente):** concluída a segunda vaga do redesign dos interiores que ainda estavam no aspeto legado. `/inicio` é agora um centro de entrada com KPIs, ações rápidas e onboarding; `/despesas` ganhou análise mensal, distribuição, filtros, tabela e drawer com data civil; `/planeamento` apresenta score explicável, fundo, cash sweep, objetivos e produtos; `/conta-conjunta` distingue os estados pessoal/conjunto, convites, membros e objetivos; `/relatorios` inclui preview coerente, exportação e arquivo privado; `/investimentos` mostra KPIs, alocação, tabela e drawer com modo patrimonial. Não foram fabricados dados históricos nem botões sem comportamento.

As leituras de `/despesas` e `/planeamento` deixaram de escrever silenciosamente na base: categorias e settings só são criados/alterados por fluxos explícitos. As datas das linhas PDF/CSV passaram a usar a data civil de `Europe/Lisbon`. Screenshots reais desktop e mobile: `docs/visual-audit/{inicio,despesas,planeamento,conta-conjunta,relatorios,investimentos}-{desktop,mobile}.png`.

Validação desta vaga: lint e typecheck verdes; renderização real desktop/mobile verificada na base `fintwin_demo_ui`. A suite Vitest executou 176 testes, com 175 verdes e apenas o teste de pré-condição do seed da base de integração bloqueado (a base existente não estava preparada e não foi reinicializada). O build Turbopack continua bloqueado pelo `EPERM` ambiental ao tentar abrir a porta interna do processador CSS. Não houve reset/seed, push ou início da Fase 20.

Todas as rotas principais têm agora shell e interiores alinhados ao padrão visual atual. Blocos ilustrativos dos mockups que não têm dados ou motor de domínio **não** foram inventados.

## Operacionalização reproduzível (2026-10-21)

- O build deixou de depender da rede: Geist Sans/Mono são servidas por `next/font/local` a partir de ficheiros versionados.
- `development`, `demo`, `e2e`, `staging` e `production` têm perfis e bases explicitamente separados. O runtime, os comandos de migração e o seed recusam combinações cruzadas; staging/produção nunca aceitam seed.
- O teste de isolamento cria e remove as suas próprias fixtures, sem depender de João/Maria no seed. A limpeza Playwright deixou de aceitar a base principal.
- `pnpm typecheck` é válido num clone limpo via `next typegen`. `pnpm ci:verify` prepara E2E e executa lint, tipos, testes, build e Playwright strict contra o standalone.
- O Dockerfile produz uma imagem Next.js standalone. Staging e produção reutilizam essa mesma imagem imutável através de `compose.deploy.yml`, com bases e volumes distintos.
- GitHub Actions executa o quality gate em cada PR/push; o workflow de release só publica uma tag `sha-<commit>` depois de o gate passar. Os comandos `deploy:staging` e `deploy:production` também executam o gate antes de migrar/arrancar.
- Portão validado num clone lógico limpo/base nova: **6/6 testes de política**, **235/235 Vitest**, build de produção standalone e **87/87 Playwright**. A imagem Docker foi construída de raiz e respondeu `200` em `/api/health` com PostgreSQL disponível.

**Polimento visual aurora (2026-10-18):** `/receitas`, `/patrimonio`, `/alertas`, `/analises`, `/previsoes` e `/simulacoes` receberam o tratamento visual das novas referências: fundo azul-violeta muito subtil, cartões translúcidos com contornos tonais, marca em gradiente, chamadas à ação com gradiente e maior profundidade nos estados ativos. O tratamento começou nestas rotas e foi depois estendido ao restante produto. Foram preservados dados, cálculos, Server Actions, regras financeiras e estados vazios reais. A composição de Receitas e as tabelas de Património também foram ajustadas para não colidir em larguras desktop intermédias. Screenshots reais: `docs/visual-audit/{receitas,patrimonio,alertas,analises,previsoes,simulacoes}-{desktop,mobile}.png`.

Validação deste polimento: lint e typecheck verdes; 175 de 176 testes Vitest verdes e 159 de 159 verdes ao excluir apenas a pré-condição de integração. A única falha da suite completa continua a ser o seed ausente de `workspace-isolation.test.ts`; a base não foi reinicializada nem semeada para a contornar. O build descarregou as fontes com acesso autorizado, mas o Turbopack voltou a falhar por `EPERM` ao tentar abrir a porta interna do processador CSS. Não houve push nem início da Fase 20.

**Extensão aurora a todas as páginas (2026-10-18):** a mesma linguagem visual foi aplicada a Dashboard, Contas e detalhe de conta, Transações, Orçamentos, Despesas recorrentes, Início, Despesas, Planeamento, Conta conjunta, Relatórios e Investimentos. `AppShell` usa agora o tema aurora por omissão, mantendo a opção explícita para futuras variantes. Os cartões `DashboardKpiCard` passaram a partilhar o tratamento tonal dos restantes KPI. Nenhum dado, serviço, regra financeira ou comportamento foi substituído pelos valores ilustrativos das referências.

**Polimento de movimento e contraste (2026-10-18):** os donuts de Despesas recorrentes, Receitas, Património, Análises, Despesas e Investimentos usam agora a mesma animação de entrada suave dos restantes gráficos circulares. O cabeçalho ganhou um bloco de sessão coerente com o tema, com avatar, nome, estado e ação de saída. O modo escuro recebeu contraste reforçado nas superfícies, texto secundário, cores semânticas, formulários, eixos, legendas e tooltips. A validação visual confirmou a animação durante o carregamento e contraste calculado claro para os textos anteriormente ilegíveis.

**Correções finais de contraste e produção (2026-10-18):** os estados vazios, separadores ativos e cartões semânticos deixaram de herdar fundos claros no modo escuro; os cenários base, otimista e pessimista de Previsões ganharam superfícies escuras tonais com contraste reforçado. Os botões «Ver» que aplicam períodos em Alertas, Receitas e Património têm agora feedback de hover/foco coerente com o tema. Foi acrescentado um bootstrap de produção protegido que cria apenas Tomás e Telmo, cada um com workspace pessoal vazio, sem seed financeiro. A base isolada `fintwin_live` foi migrada e preparada. A instância temporária na porta 3100 foi parada porque o fallback Webpack não processava o pipeline Tailwind; a aplicação visualmente correta permanece na porta 3000 e a produção deve ser construída exclusivamente com `pnpm build` (Turbopack).

**Contas e ações reversíveis (2026-10-19):** `/contas` permite eliminar uma conta por arquivamento, preservando movimentos e auditoria; a operação é bloqueada enquanto existirem receitas, recorrências, objetivos ou investimentos ativos associados. Em `/despesas-recorrentes`, pagamentos e ocorrências ignoradas aparecem no histórico recente e podem ser repostos. Anular um pagamento remove logicamente apenas o movimento associado, volta a colocar a ocorrência como pendente e repõe o saldo exato da conta debitada. Os seletores de pagamento preferem contas à ordem e deixam a poupança para escolha explícita, com aviso visual. Migração e cliente Prisma atualizados; lint, typecheck e os 179 testes passaram contra a base E2E isolada.

**Entrada e build de produção (2026-10-20):** `/` deixou de expor a página técnica inicial e encaminha agora uma sessão ativa para `/inicio` e visitantes para `/login`. Foi acrescentada a integração PostCSS oficial do Tailwind 4, garantindo que o fallback Webpack gera todos os utilitários CSS quando o Turbopack não pode abrir o processo auxiliar no ambiente local. A produção na porta 3000 foi recompilada e validada visualmente com o tema, navegação e avatar corretos. Lint, typecheck, 182 testes e build de produção passaram.

## Preparação avaliação visual (2026-10-17)

Estado: **em curso** (UX / demo, sem Fase 20).

- Hydration tema: `ThemeBootstrap` + cookie `fintwin_theme` (sem `ThemeScript` pré-hidratação).
- Base demo: `fintwin_demo_ui` (`pnpm db:demo-ui`, `pnpm dev:demo`); principal `fintwin` intacta.
- E2E: Playwright → `fintwin_e2e` por omissão (`pnpm db:e2e`).
- Relatório: `docs/PHASE19_VISUAL_AUDIT.md`; screenshots `docs/visual-audit/`.
- Alertas: botão «Atualizar alertas» visível com lista vazia (demo + E16).

## Portão

```bash
pnpm gate
CI=1 pnpm test:e2e:strict
```

Última verificação Fase 19: **165** unitários; **69** E2E strict ×3.
Pós-redesign (shell + KPIs nas 11 rotas): `pnpm build` + **69** E2E strict ×3 (2026-10-17, 0 falhas).
Screenshots pós-redesign: `docs/visual-audit/` (`pnpm audit:screenshots` com `pnpm dev:demo`).

**Paridade mockup:** shell e cartões métricos alinhados às referências em `docs/design-references/`; interiores (tabelas densas, calendários, simuladores ilustrativos) em evolução — ver `docs/PHASE19_VISUAL_AUDIT.md`.
