# Plano de fecho de lacunas críticas (relatório 10/10 v2.0)

Fonte: `fintwin-relatorio-lacunas-e-roadmap-10-10-atualizado.pdf` (25 out 2026).  
Objectivo: **implementar primeiro o que bloqueia go-live** (R1–R7 e achado de integridade de documentos), antes de ampliar features corporativas ou ML avançado.

Legenda de onde o trabalho vive:

| Tipo | Significado |
|------|-------------|
| **Código** | Monólito Next.js, Prisma, CI, scripts |
| **Infra** | Terraform, cloud, KMS, redes (fora do portão unitário) |
| **Processo** | Pentest, on-call, evidências, DPO/jurídico |

---

## 1. Críticos e altos — o que tratar primeiro

| ID | Severidade | Lacuna (Gxx) | Estado no PDF | Prioridade de implementação |
|----|------------|--------------|---------------|---------------------------|
| **R7** | Alto (achado E2E) | Integridade DB↔storage | G06 adjacente | **P0 — 1.º no código** |
| **R1** | Crítico | Rate limit distribuído (G03) | Aberto | **P0** — Redis/edge + API sensível |
| **R2** | Crítico | Infra só de referência (G27) | Parcial | **P1 — infra** staging real |
| **R4** | Alto | Cofre/KMS real (G04) | Parcial | **P1 — infra** + adaptador `*_FILE` |
| **R6** | Alto | Carga/failover (G26) | Aberto | **P1** — k6 + drill documentado |
| **R3** | Alto | Pentest (G30) | Aberto | **P1 — processo** + fixes |
| **R5** | Alto | WORM/SIEM (G09, G19) | Parcial | **P2** — sink + retenção |
| **R8** | Médio | CSP (G25 adj.) | Parcial | **P2** |
| **R9** | Médio | ML eval gate | Fase 10 | **P3** (após R1–R7) |
| **R10** | Médio | Corporativo raso | Fase 28 | **P3** (após prova operacional) |

**Decisão do relatório:** não abrir dados financeiros reais de terceiros até R1–R7 terem owner, prazo, teste e risco residual aceite.

---

## 2. Onda 0 — P0 (0–4 semanas, foco repositório)

Trabalho que **não depende de cloud** mas fecha o achado de validação e reduz R1/R7 de forma mensurável.

### 2.1 R7 — Documentos órfãos (ENOENT)

**Problema:** registos `Document` com `storageKey` sem blob no backend (local/S3).

**Entregas (Código):**

1. **Verificador** `scripts/documents-integrity-check.mjs` (ou serviço `document-integrity.ts`):
   - Para cada workspace (ou global): `findMany` documentos → `read(storageKey)` via `document-storage`.
   - Classificar: `OK`, `MISSING`, `DECRYPT_FAIL`.
2. **Quarentena:** campo `integrityStatus` (`OK` | `QUARANTINED`) ou tabela `DocumentIntegrityFinding` (workspaceId, documentId, detectedAt, reason).
3. **Acção manager:** `/empresa/auditoria` ou job backoffice — listar órfãos; acção «Marcar indisponível» (não apagar ledger); download devolve 410 + evento auditado.
4. **Migração auditada:** script one-shot `pnpm documents:integrity:repair` — só com `--dry-run` default; `--apply` gera `appendAuditEvent` por linha.
5. **CI/E2E:** teste de integração com ficheiro em falta; alerta em `ops:alert-check` se `MISSING > 0` em staging.

**Critério de aceitação:** zero ENOENT silencioso em `/api/documents/[id]`; relatório JSON exportável; E2E não regista ENOENT no log do servidor.

**Ficheiros prováveis:** `src/server/services/documents.ts`, `src/server/storage/document-storage.ts`, `prisma/schema.prisma`, `docs/SECURITY_AUDIT.md`.

---

### 2.2 R1 / G03 — Rate limit verdadeiramente distribuído

**Estado actual:** buckets de login em PostgreSQL (`AuthRateBucket` em `auth-protection.ts`) — melhor que memória pura, mas **não cobre edge multi-réplica nem rotas API** (exports, webhooks admin, step-up).

**Entregas (Código):**

1. **Contrato** em `src/server/security/rate-limit-store.ts`: `increment(key, windowMs) → { allowed, remaining, resetAt }`.
2. **Implementações:** `postgres-rate-limit-store` (actual), **`redis-rate-limit-store`** (ioredis / `FINTWIN_REDIS_URL`).
3. **Política central** `src/lib/security/rate-limit-policy.ts`: mapa rota/ação → limites (login, forgot-password, export PDF/CSV, accounting-csv, webhook create).
4. **Middleware** ou helper em rotas `src/app/api/**` críticas + Auth.js callbacks.
5. **Deteção credential stuffing:** manter lógica actual; garantir que **todas as réplicas** partilham store (Redis preferido em produção).
6. **Testes:** unitários store; integração Redis opcional (skip se URL ausente); E2E abuso login (429).

**Critério de aceitação:** com 2 instâncias app + Redis, 6.º login falhado bloqueia em ambas; documentação env `FINTWIN_REDIS_URL` em `docs/SECURITY_CENTER.md`.

**Nota infra (P1):** Redis gerido na mesma VPC que staging; não bloquear Onda 0 — PG store permanece fallback em dev.

---

### 2.3 DAST regular (G24, complemento R3)

**Entregas (CI):**

1. Workflow semanal/manual `dast-staging.yml` contra `FINTWIN_DAST_TARGET_URL` (já placeholder).
2. Falhar fechado se ZAP reportar **High** novos vs baseline guardado.
3. Documentar em `docs/PENTEST_READINESS.md`.

---

## 3. Onda 1 — P1 infra + prova externa (30–60 dias)

Alinha com horizonte **0–30 / 30–60 dias** do PDF.

### 3.1 R2 / G27 — Staging real equivalente

| Entrega | Tipo | Detalhe |
|---------|------|---------|
| Aplicar `infra/terraform/` em conta cloud | Infra | RDS Multi-AZ, bucket privado, rede privada |
| `compose.deploy.yml` → imagem assinada Cosign | Infra | Mesmo artefacto que CI |
| Secrets via **Secrets Manager / Vault** | Infra + Código | Mapear para `DATABASE_URL_FILE`, `AUTH_SECRET_FILE`, etc. |
| Health gate pós-deploy | Código | Já existe `deploy-rollout.mjs` — evidência guardada em CI artefacto |

**Critério:** checklist «staging equivalente a prod» assinado; `/api/health` verde; auditoria 503 testada.

### 3.2 R4 / G04 — KMS e rotação

| Entrega | Detalhe |
|---------|---------|
| Chaves documentos/backup/audit por ambiente | KMS CMK ou envelope com rotação anual |
| Runbook rotação | `docs/runbooks/key-rotation.md` + drill trimestral |
| Proibir fallback dev keys | `environment-policy` já fail-closed — validar em staging |

### 3.3 R6 / G26 — Carga, failover, restore

| Entrega | Tipo |
|---------|------|
| Suite **k6** (`tests/load/`) — login, dashboard, export CSV, reconciliação | Código |
| Job CI `load-smoke` (não bloqueante inicialmente) | CI |
| Game day trimestral: failover RDS, restore FTBACK01, rollback imagem | Processo + script |
| Métricas RTO/RPO registadas | `docs/BUSINESS_CONTINUITY.md` |

### 3.4 R3 / G30 — Pentest

| Entrega | Tipo |
|---------|------|
| Scope ASVS L2 + rotas corporativas | Processo |
| Remediação P0/P1 no repo | Código |
| Registo achados abertos/fechados | `docs/PENTEST_READINESS.md` |

---

## 4. Onda 2 — P2 observabilidade e arquivo (60–90 dias)

### 4.1 R5 / G09 + G19 — WORM + SIEM

1. Export audit JSONL → bucket **Object Lock** (WORM) ou serviço equivalente.
2. Vector/Datadog/Splunk — ingestão real (substituir «example»).
3. Alertas: `AuditTamperAttempt`, health 503, `documents-integrity` MISSING > 0, rate limit blocks spike.
4. On-call rota + runbook `INCIDENT_RESPONSE.md` com owner nomeado.

### 4.2 R8 — CSP

Pipeline nonce/hash; reduzir `unsafe-inline` onde Recharts/scripts permitirem.

---

## 5. Onda 3 — Corporativo e ML (após R1–R7)

Só depois da **prova operacional** (secção 3–4).

### 5.1 Fase corporativa «9.1» (PDF §8)

Ordem sugerida **no produto**:

1. Open Banking **TPP real** + consent lifecycle (SCA, revoke, refresh).
2. Reconciliação: **fecho diário**, fila de exceções, métricas `% auto-match`, centro de divergências.
3. Webhooks: fila `PlatformJob`, retries, idempotência `X-FinTwin-Delivery-Id`, portal API read-only.
4. Maker-checker: matriz de limites (montante, tipo) + SoD organizacional documentada.
5. ERP: plano SNC configurável + conector (SAP Business One / Primavera — adapter interface).

### 5.2 Fase ML «10» (PDF §9)

Registry local, prompts versionados, golden set pt-PT, **eval gate no CI**, drift, kill switch por feature — ver `docs/DPIA_LOCAL_AI.md`.

---

## 6. Roadmap de fases no monólito (proposta)

| Fase | Nome | Escopo principal | Portão |
|------|------|------------------|--------|
| **29** | Integridade de documentos | R7 — verificador, quarentena, repair auditado | test + E2E |
| **30** | Rate limit distribuído | R1 — Redis store, API routes, stuffing | test + carga smoke |
| **31** | Staging operacional | R2/R4 — evidência terraform + KMS (doc + scripts) | checklist manual |
| **32** | Resiliência demonstrável | R6 — k6, game day, RTO/RPO | CI + runbook |
| **33** | Pentest & DAST | R3/G24 — baseline ZAP, remediação | security workflow |
| **34** | WORM/SIEM | R5 — export imutável + alertas | ops |
| **35** | Corporativo profundo | OB real, exceções reconciliação, webhooks fila | E2E |
| **36** | Governação ML | R9 — registry, eval gate | CI bloqueante |

Actualizar `docs/ROADMAP.md` e `docs/PROGRESS.md` quando cada fase **fechar portão completo** (incl. E2E se houver rotas novas).

---

## 7. Ordem de execução imediata (checklist)

Use esta sequência para sprints; não paralelizar P0 com pentest antes de R7/R1.

- [x] **Sprint A:** Fase 29 — integridade documentos (R7) — ver `document-integrity.ts`, `pnpm documents:integrity:check`.
- [x] **Sprint B:** Fase 30 — Redis rate limit + rotas API (R1) — `FINTWIN_REDIS_URL`, `enforce-api-rate-limit.ts`.
- [x] **Sprint C:** DAST staging baseline + agenda pentest (R3) — `dast-staging.yml`, `dast-compare-baseline.mjs`, `PENTEST_READINESS.md`.
- [x] **Sprint D:** Terraform staging + KMS (R2/R4) — `kms.tf`, `secrets.tf`, Redis staging, `STAGING_KMS.md`, `terraform-staging-plan.yml`.
- [x] **Sprint E:** k6 + game day restore/failover (R6) — `tests/load/`, `load-smoke.yml`, `game-day-drill.mjs`, runbooks.
- [x] **Sprint F:** WORM/SIEM ligação real (R5) — `audit_worm.tf`, `audit-worm-sync.mjs`, `WORM_SIEM.md`, SIEM em `ops-alert-check`.
- [x] **Sprint G (base):** excepções/fecho reconciliação, webhooks `WEBHOOK_DELIVERY`, TPP HTTP refresh/revoke, gate ML eval P10/P90 — ver `OPEN_BANKING_TPP.md`, `release-eval-gate.ts`.

---

## 8. O que **não** fazer primeiro

- Previsões P10/P50/P90, copiloto reconciliação, assistente empresarial (PDF §10–12) — dependem de governação ML (R9).
- Novos dashboards ou KPIs cosméticos — baixo impacto na nota «produção pública» vs R1–R7.
- Certificação ISO/PCI — horizonte 12+ meses (PDF §12).

---

## 9. Ligação aos critérios 10/10 (PDF §13)

Cada onda deve produzir **evidência artefactada** (logs CI, relatórios JSON, runbooks datados), não apenas código:

- **Identidade:** rate limit distribuído testado multi-réplica.
- **Dados:** KMS + rotação exercitada.
- **Auditoria:** WORM + SIEM alerta testado.
- **Continuidade:** RTO/RPO medidos num drill.
- **AppSec:** pentest sem críticos/altos abertos + DAST regular.
- **Finanças:** reconciliação com feed real e métricas de acerto (fase 35).

---

*Plano de engenharia — não substitui parecer jurídico, pentest contractuel ou certificação regulatória.*
