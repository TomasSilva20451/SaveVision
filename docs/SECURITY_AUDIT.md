# Auditoria de segurança (Fases 13 e 26)

## Modelo de autorização

- Toda operação financeira exige `requireWorkspaceAccess` ou `requireWorkspaceEditor` no servidor.
- O cookie `fintwin_workspace` só é definido após `setActiveWorkspace`, que valida membership `ACTIVE`.
- Documentos e relatórios usam o workspace ativo da sessão; o registo na base inclui `workspaceId` e é filtrado em leitura.

## Correções da Fase 13

| Prioridade | Problema | Correção |
| --- | --- | --- |
| CRÍTICO | Despesas/receitas aceitavam `accountId` de outro workspace | `findAccountInWorkspace` em serviços de receitas e despesas |
| ALTO | PDF truncado a 40 movimentos com totais inconsistentes | Relatórios por intervalo com listagem completa e totais alinhados |
| ALTO | Upload confiava só no MIME do browser | Deteção por assinatura (`file-sniff`) + validação cruzada + malware scan (`document-malware-scan.ts`, ClamAV opcional) |
| MÉDIO | Confirmação de receita com condição de corrida | `updateMany` com `status EXPECTED` dentro da transação |
| MÉDIO | Avisos `crypto.getRandomValues` no prerender | `ensureRequestDynamic()` (`connection()`) nas rotas autenticadas |

## Testes de isolamento

- `src/server/security/workspace-isolation.test.ts` (PostgreSQL local)
- E2E com dois contextos de browser (`e2e/02-dual-user-isolation.spec.ts`)

## Segredos, cifra e TLS (Fase 26)

- **Segredos montados:** staging e produção recebem `DATABASE_URL`, `AUTH_SECRET`, chave documental e chave de auditoria por ficheiros `*_FILE`. O `runtime-entrypoint` resolve-os apenas na memória do processo. Os exemplos de produção contêm caminhos, nunca valores.
- **Separação por ambiente:** os identificadores das chaves têm de começar por `staging-` ou `production-`; a validação bloqueia reutilização acidental. Bases e volumes continuam separados pelas políticas da Fase 21.
- **TLS fail-closed:** staging/produção exigem URL pública HTTPS, `FINTWIN_ENFORCE_TLS=1` e PostgreSQL com `sslmode=require`, `verify-ca` ou `verify-full`. O proxy redireciona HTTP com 308 e publica HSTS; `/api/health` permanece acessível ao healthcheck interno.
- **Documentos cifrados:** novos uploads usam envelope `FTENC01`, AES-256-GCM, IV aleatório, AAD com `keyId` e tag de autenticação. Em staging/produção, plaintext legado é recusado com `FINTWIN_REQUIRE_ENCRYPTED_DOCUMENTS=1`.
- **Backups cifrados:** dump, documentos e arquivo de auditoria usam o formato autenticado `FTBACK01` (AES-256-GCM + scrypt). Plaintext é removido e a chave vem de cofre/ficheiro 0600. Ver `docs/BACKUP_RESTORE.md`.

## Ledger append-only assinado

`AuditEvent` é o registo forense transversal. Cada evento inclui:

- identidade (`actorUserId` ou `actorReference`), instante UTC e `workspaceId`;
- ação, tipo/ID do recurso e resultado (`SUCCESS`, `DENIED` ou `FAILURE`);
- origem, `requestId`, hashes de IP e user-agent e metadados minimizados;
- `previousHash`, `eventHash`, assinatura HMAC-SHA256 e `signingKeyId`.

Integridade de documentos: `StoredDocument.integrityStatus`, verificação `pnpm documents:integrity:check`, quarentena automática em download falhado (HTTP 410), health `unavailableDocuments` e alerta ops.

O hash canónico encadeia os eventos sob um advisory lock PostgreSQL. Triggers bloqueiam `UPDATE` e `DELETE` em `AuditEvent` e `AuditTamperAttempt`; qualquer tentativa fica em `AuditTamperAttempt`. O endpoint `/api/health` passa a crítico (HTTP 503) quando existe uma tentativa, para integração com monitorização/SIEM.

Além da base operacional, cada evento é escrito em `storage/audit/<ambiente>/audit-events.jsonl`. Em staging/produção este arquivo é obrigatório, vive num volume separado, entra no backup/off-site e tem retenção independente. Assim, apagar ou restaurar a base operacional não elimina a segunda prova.

Cobertura explícita: logins e bloqueios, exportações PDF/CSV/dados pessoais, uploads/downloads, eliminação/arquivo, permissões e convites, contas, transações, transferências, rendimentos, despesas, orçamentos, objetivos, investimentos, passivos e recorrências.

Verificação operacional:

```bash
pnpm audit:verify
```

O comando recalcula a cadeia e as assinaturas e falha perante hash, assinatura, chave ou tentativa de adulteração inválidos. Rotação de chaves deve preservar as chaves antigas num cofre read-only até terminar a retenção dos eventos que assinam.

Runbook de incidente: `docs/runbooks/audit-ledger-incident.md`.

## Riscos remanescentes

- Rate limit de login em memória (reinicia com o processo). **Produção:** mover contadores para Redis/Upstash ou rate limit no edge (Vercel Firewall / Cloudflare) com chave `email+IP`; manter janela deslizante e resposta 429 uniforme.
- `FINTWIN_DISABLE_LOGIN_RATE_LIMIT=1` só no processo `next dev` do Playwright; `isLoginRateLimitBypassAllowed()` devolve **sempre false** quando `NODE_ENV=production`. Não é configurável pelo cliente.
- Múltiplas instâncias sem store partilhado: cada réplica tem contador independente (risco de brute-force distribuído).
- Despesas recorrentes: acesso só via `requireWorkspaceAccess`/`Editor`; E2E confirma isolamento João/Maria (`e2e/07-recurring-expenses.spec.ts` E10).
- **Limpeza E2E (17b.1):** política fail-closed em `src/lib/e2e/cleanup-policy.ts`. `FINTWIN_ALLOW_E2E_CLEANUP=yes` **não** autoriza bases remotas nem produção; bloqueia nomes backup/prod e coincidência com `FINTWIN_PRIMARY_DATABASE_URL`. DELETE limitado ao prefixo `E2E17a-`. Falha de política → erro no `globalSetup` (sem apagar dados).
- Armazenamento de documentos em disco local (adequado a dev; produção requer volume privado). Backups cifrados, off-site, PITR e drills: `docs/BUSINESS_CONTINUITY.md`, `docs/BACKUP_RESTORE.md`.
- Sem envio de email para convites (fluxo manual com token).
