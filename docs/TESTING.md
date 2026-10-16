# Estratégia de testes

## Unitários (Vitest)

```bash
pnpm test
```

Incluem motor financeiro, relatórios, sniff de ficheiros, convites (mock) e isolamento com PostgreSQL quando `DATABASE_URL` está acessível.

## E2E (Playwright)

```bash
pnpm exec playwright install chromium
pnpm test:e2e          # dev: next dev na porta 3010
pnpm test:e2e:ci       # CI: build + next start + CI=1
```

O servidor de testes usa a porta `3010` (`FINTWIN_E2E_PORT` opcional). Em `CI=1` usa `next start` (requer `pnpm build` prévio). `FINTWIN_DISABLE_LOGIN_RATE_LIMIT=1` só no processo Playwright.

`e2e/global-setup.ts` apaga **apenas** recorrências com prefixo `E2E17a-`. A política `evaluateE2eCleanupPolicy` exige ambiente E2E **local** (`fintwin@localhost:5433`, ou `*_e2e` em localhost com confirmação). Ver testes em `src/lib/e2e/cleanup-policy.test.ts`.

```bash
pnpm test:e2e:strict   # CI=1, retries=0 (diagnóstico de flakiness)
```

Cenários: autenticação, isolamento, fluxos financeiros, relatórios, tesouraria (`e2e/08-treasury-forecast.spec.ts`), recorrências (`e2e/07-recurring-expenses.spec.ts`).

## Portão de release

```bash
pnpm gate              # lint + build + typecheck + test
CI=1 pnpm test:e2e     # CI Playwright (retries=2)
```

### Build e typecheck

`pnpm typecheck` requer tipos gerados (`.next/types`). Num clone limpo: `pnpm build` antes do primeiro typecheck, ou `pnpm gate`. Evitar `next dev` e `next build` em simultâneo na mesma pasta `.next`.
