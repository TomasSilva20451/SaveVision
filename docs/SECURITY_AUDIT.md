# Auditoria de segurança (Fase 13)

## Modelo de autorização

- Toda operação financeira exige `requireWorkspaceAccess` ou `requireWorkspaceEditor` no servidor.
- O cookie `fintwin_workspace` só é definido após `setActiveWorkspace`, que valida membership `ACTIVE`.
- Documentos e relatórios usam o workspace ativo da sessão; o registo na base inclui `workspaceId` e é filtrado em leitura.

## Correções da Fase 13

| Prioridade | Problema | Correção |
| --- | --- | --- |
| CRÍTICO | Despesas/receitas aceitavam `accountId` de outro workspace | `findAccountInWorkspace` em serviços de receitas e despesas |
| ALTO | PDF truncado a 40 movimentos com totais inconsistentes | Relatórios por intervalo com listagem completa e totais alinhados |
| ALTO | Upload confiava só no MIME do browser | Deteção por assinatura (`file-sniff`) + validação cruzada |
| MÉDIO | Confirmação de receita com condição de corrida | `updateMany` com `status EXPECTED` dentro da transação |
| MÉDIO | Avisos `crypto.getRandomValues` no prerender | `ensureRequestDynamic()` (`connection()`) nas rotas autenticadas |

## Testes de isolamento

- `src/server/security/workspace-isolation.test.ts` (PostgreSQL local)
- E2E com dois contextos de browser (`e2e/02-dual-user-isolation.spec.ts`)

## Riscos remanescentes

- Rate limit de login em memória (reinicia com o processo). **Produção:** mover contadores para Redis/Upstash ou rate limit no edge (Vercel Firewall / Cloudflare) com chave `email+IP`; manter janela deslizante e resposta 429 uniforme.
- `FINTWIN_DISABLE_LOGIN_RATE_LIMIT=1` só no processo `next dev` do Playwright; `isLoginRateLimitBypassAllowed()` devolve **sempre false** quando `NODE_ENV=production`. Não é configurável pelo cliente.
- Múltiplas instâncias sem store partilhado: cada réplica tem contador independente (risco de brute-force distribuído).
- Despesas recorrentes: acesso só via `requireWorkspaceAccess`/`Editor`; E2E confirma isolamento João/Maria (`e2e/07-recurring-expenses.spec.ts` E10).
- **Limpeza E2E (17b.1):** política fail-closed em `src/lib/e2e/cleanup-policy.ts`. `FINTWIN_ALLOW_E2E_CLEANUP=yes` **não** autoriza bases remotas nem produção; bloqueia nomes backup/prod e coincidência com `FINTWIN_PRIMARY_DATABASE_URL`. DELETE limitado ao prefixo `E2E17a-`. Falha de política → erro no `globalSetup` (sem apagar dados).
- Armazenamento de documentos em disco local (adequado a dev; produção requer volume privado e backups).
- Sem envio de email para convites (fluxo manual com token).
