# Carga k6 (R6)

Smoke de referência para staging/produção. Não substitui testes E2E.

## Pré-requisitos

- [k6](https://k6.io/docs/get-started/installation/) instalado localmente, ou Docker `grafana/k6`.

## Smoke

```bash
pnpm load:smoke
# ou
BASE_URL=https://staging.example FINTWIN_METRICS_TOKEN=... k6 run tests/load/smoke.js
```

Limiares por omissão: taxa de falhas HTTP &lt; 5%, p95 &lt; 3s (30s, 5 VUs).

## CI

Workflow `load-smoke.yml` (manual + semanal); **não bloqueia** `main` inicialmente — falhas geram artefacto JSON.

## Game day

Ver `docs/runbooks/game-day-failover.md` e `pnpm game-day:drill`.
