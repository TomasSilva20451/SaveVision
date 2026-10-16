# Relatório Fase 17c.1

## Estado: COMPLETED

## Funcionalidades

- `/patrimonio`: criar passivo com dia de vencimento; editar/remover vencimento por passivo.
- `/despesas-recorrentes`: associar/remover passivo na criação e edição.
- `/previsoes`: avisos de configuração (`configurationWarnings`).
- Servidor: validação workspace, uma recorrência activa por passivo.

## Portão (sessão de fecho)

| Comando | Resultado |
|---------|-----------|
| lint / build / typecheck | PASS |
| `pnpm test` | **142** PASS |
| `CI=1 pnpm test:e2e:strict` ×3 | **44** PASS, 0 retries (~34–37 s) |

## Fase 18

Não iniciada — alertas persistentes.
