# Resumo narrativo mensal (Gemma local)

## O que é

Parágrafo em **pt-PT** sobre o mês civil (ex.: `2026-10`), gerado a partir de totais calculados no servidor. O modelo **não recebe** a lista de transações — só um JSON de factos (`MonthlyReportFacts`).

## Pré-requisitos

1. **PostgreSQL** com migrações aplicadas (inclui tabela `MonthlyReportNarrative`):

   ```bash
   DATABASE_URL="postgresql://…" pnpm exec prisma migrate deploy
   pnpm exec prisma generate
   ```

2. **Ollama** em execução (opcional mas recomendado):

   ```bash
   ollama pull gemma3:4b
   ```

3. **`.env`** (omissões):

   ```env
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_REPORT_MODEL=gemma3:4b
   ```

   Se o Ollama falhar ou alterar montantes, o servidor usa **fallback determinístico** (texto sempre disponível).

4. **Servidor Next.js** — após `prisma generate`, reinicia o `next dev` para carregar o cliente Prisma atualizado.

## Tutorial — usar no browser

### 1. Entrar na app

1. Abre `http://localhost:3001/login` (ou a porta que uses).
2. Inicia sessão com um utilizador do workspace (ex.: demo E2E `joao@fintwin.local` / `demo-joao-2026`, ou utilizadores de produção bootstrap).
3. Confirma o **workspace** correto no seletor (pessoal vs conjunto). O resumo é **por workspace**.

### 2. Ir a Relatórios

1. Menu lateral → **Relatórios** (`/relatorios`).
2. No topo vês KPIs do intervalo predefinido (1.º dia do mês civil até hoje, timezone `Europe/Lisbon`).
3. Desce até **Resumo narrativo do mês**.

### 3. Gerar o texto

1. Clica **Gerar resumo** (ou **Regenerar resumo** se já existir).
2. O botão passa a **A gerar…** (~10–20 s com `gemma3:4b` local).
3. Aparece o parágrafo + metadados:
   - **Modelo** (ex.: `gemma3:4b` ou `deterministic-fallback`)
   - **Versão do prompt** (ex.: `2026-10-21`)
   - **Gerado em** (data/hora Lisboa)

### 4. O que esperar no texto

Conforme os dados do mês, o resumo pode incluir:

- receitas, despesas, saldo e taxa de poupança;
- principais categorias de despesa;
- variação face ao mês anterior (se existir histórico);
- execução de orçamentos, objetivos, alertas, atípicos, compromissos recorrentes;
- **limitações** quando não há meses ou movimentos suficientes (sem inventar tendências).

### 5. Exportações PDF/CSV

As exportações na mesma página usam o intervalo **De / Até** dos formulários. Marca **Incluir resumo narrativo do mês (se existir)** — activo por omissão quando o intervalo é um mês civil completo. O PDF inclui a secção «Resumo narrativo»; o CSV acrescenta a linha `Narrativa` no bloco summary quando há registo para o `periodKey` do intervalo.

### 6. Auditoria na base de dados

Cada geração grava um registo com `sourceFactsJson`, modelo, `promptVersion`, `generatedAt` e `generatedById`. Permite comparar texto vs factos e regenerar.

## Fluxo técnico

1. `buildMonthlyReportFacts` — agrega dados no servidor.
2. Ollama (`ollama-monthly-report-narrative.ts`) — redação a partir do JSON.
3. `narrativeMatchesFacts` — rejeita montantes alterados pelo modelo.
4. Fallback — `buildDeterministicMonthlyNarrative`.
5. Persistência — `MonthlyReportNarrative`.

## Ficheiros principais

| Área | Caminho |
|------|---------|
| Factos + validação | `src/lib/finance/monthly-report-summary.ts` |
| Builder (BD) | `src/server/services/monthly-report-summary-builder.ts` |
| Orquestração | `src/server/services/monthly-report-narrative.ts` |
| Ollama | `src/server/providers/ollama-monthly-report-narrative.ts` |
| UI | `src/components/reports/monthly-report-narrative-panel.tsx` |
| Página | `src/app/relatorios/page.tsx` |

## Resolução de problemas

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Erro `findFirst` em `monthlyReportNarrative` | Cliente Prisma desatualizado | `pnpm exec prisma generate` + reiniciar `next dev` |
| Erro ao abrir `/relatorios` | Migração em falta | `pnpm exec prisma migrate deploy` |
| Texto genérico com zeros | Sem receitas/despesas no mês no workspace | Regista movimentos ou muda de workspace |
| Demora longa | Modelo local a carregar | Normal na 1.ª chamada; confirma `OLLAMA_BASE_URL` |
