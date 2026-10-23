# Assistente financeiro (leitura, Ollama local)

## Objetivo

Permitir perguntas em português de Portugal sobre dados já registados no workspace, sem expor SQL, IDs sensíveis ou capacidade de escrita ao modelo.

## Fluxo

1. UI (`/assistente`) envia a pergunta via server action.
2. `ollamaFinancialAssistantProvider` devolve JSON: `intent`, `parameters`, `confidence`, `clarification`.
3. `validateAssistantIntent` aplica a allowlist e schemas Zod.
4. `requireWorkspaceAccess` + `resolveWorkspaceContext` fixam o `workspaceId` (nunca confiar no cliente).
5. `runAssistantTool` executa funções de leitura (Prisma + agregados existentes, `Decimal`, datas civis `Europe/Lisbon`).
6. `formatAssistantAnswer` gera texto em pt-PT com evidências (máx. 8 linhas) e links profundos (`/transacoes?…`, `/orcamentos`, etc.).

## Intenções suportadas

| Intent | Parâmetros | Fonte de dados |
|--------|------------|----------------|
| `expense_total_by_category` | `categoryName`, `period?` | Transações `EXPENSE` concluídas |
| `expense_trend_by_category` | `months?` (default 3) | Totais por categoria, janela recente vs anterior |
| `savings_rate` | `period?` | Receitas/despesas concluídas; fórmula `(R−D)/R×100` |
| `upcoming_payments` | `days?` (default 7) | Eventos de tesouraria (recorrências `EXPECTED`, passivos) |
| `emergency_fund_gap` | — | `getPlanningOverview` (objetivo vs poupança) |
| `highest_balance_account` | — | `listAccountsWithBalances` |
| `can_save_monthly` | `amount` | Média de fluxo líquido dos últimos 6 meses civis |

Categorias: o modelo só envia **nome**; o servidor resolve `categoryId` com `matchCategoryByName` e rejeita nomes inexistentes.

## Ollama

- Variáveis: `OLLAMA_BASE_URL`, `OLLAMA_TRANSACTION_MODEL` (omissão `qwen3.5:4b-mlx`), `OLLAMA_ALLOW_REMOTE`.
- Apenas localhost por omissão; timeout 45 s.
- Testes unitários mockam o provider — não exigem Ollama em CI.

## Limites de segurança

- Só leitura; sem create/update/delete.
- Pergunta truncada a 500 caracteres; até 5000 movimentos por consulta (`dataIncomplete` se atingido).
- Descrições de movimentos truncadas a 72 caracteres nas evidências.

## Ficheiros principais

- `src/lib/finance/financial-assistant-intents.ts`
- `src/server/providers/ollama-financial-assistant.ts`
- `src/server/services/financial-assistant.ts`
- `src/server/services/financial-assistant-tools.ts`
- `src/lib/finance/financial-assistant-actions.ts`
- `src/app/assistente/page.tsx`
