# Proposta: confirmação unificada recorrência ↔ passivo (fase futura)

## Problema

`linkedLiabilityId` evita dupla contagem na **previsão**, mas existem dois fluxos independentes:

1. `confirmRecurringExpenseOccurrence` → `Transaction` EXPENSE + ocorrência PAID.
2. `recordLiabilityPayment` (WITH_BANK) → amortização + movimentos bancários.

O checkbox `acknowledgeLinkedLiabilityRisk` (Fase 18) é UX/validação; **não** garante atomicidade.

## Objetivo

Uma operação **atómica** que, quando o utilizador confirma a prestação ligada:

- Marca a ocorrência recorrente como PAID (idempotente).
- Regista `LiabilityPayment` com capital/juros/encargos.
- Cria no máximo os movimentos bancários acordados (sem duplicar principal).
- Atualiza `outstandingBalance` do passivo.
- Escreve auditoria financeira.

## Fora de âmbito

- Motor de simulação (Fase 19).
- Heurísticas de deduplicação por valor/data.

## Esboço técnico

- Novo serviço `confirmLinkedLiabilityInstallment(userId, workspaceId, input)` com `$transaction`.
- Pré-condições: recorrência ACTIVE com `linkedLiabilityId`, ocorrência EXPECTED/POSTPONED, editor no workspace.
- Política: um movimento bancário líquido ou decomposição explícita documentada.
- Testes de integração PostgreSQL + E2E dedicado.
