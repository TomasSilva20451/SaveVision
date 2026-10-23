# Estratégia de testes

## Unitários (Vitest)

```bash
pnpm test
```

Incluem motor financeiro, relatórios, sniff de ficheiros, convites (mock) e isolamento com PostgreSQL quando `DATABASE_URL` está acessível.

Testes de integração que contam transações **saltam** se `DATABASE_URL` apontar para a base principal `fintwin` (evita flakiness com resíduos E2E). Usar `fintwin_e2e` ou `FINTWIN_ALLOW_INTEGRATION_ON_PRIMARY=yes` para forçar.

## E2E (Playwright)

```bash
pnpm exec playwright install chromium
pnpm test:e2e          # build + artefacto standalone isolado
pnpm test:e2e:ci       # CI: build + standalone + CI=1
```

O servidor de testes prefere a porta `3010` (`FINTWIN_E2E_PORT` opcional). `pnpm ci:verify` procura automaticamente a primeira porta livre entre 3010 e 3099. O comando compila e executa `.next/standalone/server.js`, o mesmo formato usado no contentor de produção; `FINTWIN_DISABLE_LOGIN_RATE_LIMIT=1` só existe no processo Playwright.

`e2e/global-setup.ts` apaga **apenas** recorrências com prefixo `E2E17a-`. A política `evaluateE2eCleanupPolicy` exige ambiente E2E **local** (`fintwin_e2e` ou `*_e2e` em localhost com confirmação). A antiga base de desenvolvimento `fintwin` deixou de ser aceite para qualquer limpeza E2E. Ver testes em `src/lib/e2e/cleanup-policy.test.ts`.

O Playwright usa por omissão `fintwin_e2e` (porta 3010), não a base principal. Criar/atualizar: `pnpm db:e2e`. `pnpm ci:verify` cria uma base local nova terminada em `_e2e` em cada execução, evitando resíduos entre corridas; no CI, o contentor PostgreSQL já nasce limpo com `fintwin_e2e`. Opcional: copiar `.env.e2e.example` → `.env.e2e`.

### Demonstração visual (UI)

Base dedicada **sem fixtures E2E**:

```bash
pnpm db:demo-ui    # cria fintwin_demo_ui, migrate deploy, seed idempotente
pnpm dev:demo      # Next.js em :3000 ligado à demo UI
```

A base `fintwin` (principal) permanece intacta; não executar limpeza E2E na demo UI.

```bash
pnpm test:e2e:strict   # CI=1, retries=0 (diagnóstico de flakiness)
```

Cenários: autenticação, isolamento, fluxos financeiros, relatórios, tesouraria (`e2e/08-treasury-forecast.spec.ts`), recorrências (`e2e/07-recurring-expenses.spec.ts`), UI de transações (`e2e/13-transactions-ui.spec.ts`).

A categorização Ollama não é obrigatória nos E2E: o drawer valida o painel «Categorização local» e o registo manual continua disponível se o modelo local estiver indisponível.

## Portão de release

```bash
pnpm ci:verify         # migração + lint + typecheck + unitários + build + E2E strict
```

O mesmo comando é usado por `.github/workflows/quality-gate.yml`. O workflow de release depende desse job e, portanto, não consegue publicar a imagem se o portão falhar.

### Build e typecheck

`pnpm typecheck` executa `next typegen` antes de `tsc --noEmit`; já não depende de um build anterior nem de ficheiros `.next/types` existentes. Next 16 separa os artefactos de desenvolvimento em `.next/dev`, permitindo gerar tipos/build sem reutilizar tipos residuais de outra máquina.
