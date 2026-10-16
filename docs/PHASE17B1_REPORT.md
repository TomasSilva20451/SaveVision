# Relatório Fase 17b.1 — Consolidação tesouraria, E2E e build

## 1. Estado

**COMPLETED** — portão verificado nesta sessão.

## 2. Diagnóstico inicial

| Tema | Achado |
|------|--------|
| Limpeza E2E | `FINTWIN_ALLOW_E2E_CLEANUP=yes` podia autorizar bases remotas |
| Build/typecheck | `tsconfig` inclui `.next/types`; clone limpo falhava sem `build` |
| Passivos | Sem calendário persistido; existe `monthlyPayment` |
| UI | Título genérico; aviso de limitação insuficiente |
| Desempenho | 6× leitura completa em `getTreasuryForecastAllHorizons` |
| E2E retries | CI usava `retries: 2` — verde podia incluir retries |

## 3. Correções

- Política **fail-closed** em `src/lib/e2e/cleanup-policy.ts` (8 testes).
- `global-setup` falha explicitamente se política negar (sem DELETE silencioso).
- `scripts/ensure-next-types.mjs` + ordem `gate`: build antes de typecheck.
- Passivos: `generateLiabilityMonthlyOutflows` (saída de caixa = `monthlyPayment`).
- Deduplicação por `source:id` (sem heurística valor/data).
- Uma leitura de eventos até 365 dias; horizontes calculados em memória.
- UI: «Projeção com movimentos conhecidos», aviso legal, cronologia com saldo após evento.

## 4. Portões

| Comando | Resultado |
|---------|-----------|
| `pnpm lint` | PASS |
| `pnpm build` | PASS |
| `pnpm typecheck` | PASS (após build) |
| `pnpm test` | **126** PASS |
| `CI=1 pnpm test:e2e:strict` (×3) | **35** PASS, **0 retries**, ~28–31 s |

## 5. Migrações

Nenhuma.

## 6. Proposta Fase 17c (não iniciada)

Análise de padrões (tendências de despesas, concentração mensal, subscrições) com regras estatísticas explicáveis — sem ML obrigatório.

## 7. Checkboxes Cursor

Atualizados via **TodoWrite** (plano nativo): `phase17b1-01` … `phase17b1-10`, `stage-17b1`.
