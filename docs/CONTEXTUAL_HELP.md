# Ajuda contextual (RAG local)

## Objetivo

Responder perguntas sobre **funcionalidades da aplicação** (menus, fluxos, regras) sem aceder à base de dados financeira do utilizador.

Distinto do **Assistente financeiro** (`/assistente`), que lê dados do workspace.

## Fluxo

1. Utilizador abre o botão **?** (canto inferior).
2. O cliente envia `question` + `pathname` via server action.
3. `searchHelpCorpus` escolhe excertos da coleção `HELP_CORPUS`.
4. Ollama (`OLLAMA_HELP_MODEL`, omissão `qwen2.5-coder:7b`) redige a resposta em pt-PT.
5. Validação leve + fallback determinístico se o modelo falhar ou violar regras.

## Fontes

- `src/lib/help/help-corpus.ts` — FAQ curada (docs funcionais, regras, páginas).
- `src/lib/help/page-context.ts` — intro por rota (`/despesas-recorrentes`, etc.).

## Segurança

- Sem SQL, env, credenciais ou execução de comandos.
- Sem aconselhamento de investimento.
- Prompt obriga a usar só excertos fornecidos.
- Ollama localhost por omissão (`OLLAMA_ALLOW_REMOTE=1` para excepção).

## Configuração

`/perfil/ia` — activar IA, URL Ollama, modelos texto/ajuda/imagem, testar ligação, opção de não guardar prompts.

> **Deploy público:** `127.0.0.1` visto pelo servidor Vercel/Fly não é o Mac do utilizador. A arquitectura actual chama o
> Ollama no servidor Next.js; por isso, para usar o daemon instalado no Mac, o FinTwin deve ser executado nesse Mac em
> `http://127.0.0.1:3000`. Definir `FINTWIN_LOCAL_AI_ENABLED=1` num deploy público não cria uma ponte para a máquina do
> utilizador. Uma integração hospedada futura exige um relay local autenticado e cifrado.

Produção local no Mac:

```bash
pnpm setup:production:local
pnpm build:production
pnpm start:production
```

Variáveis globais:

```env
FINTWIN_LOCAL_AI_ENABLED=1
OLLAMA_HELP_MODEL=qwen2.5-coder:7b
```

## UI

- Botão flutuante em todas as páginas com `AppShell`.
- Sugestões rápidas dependem da rota.
- **Explicar esta página** — one-shot sem pergunta; usa contexto da rota + excertos da documentação.

## Tutorial — usar no browser

### 1. Preparar

```bash
ollama pull qwen2.5-coder:7b   # ajuda contextual
pnpm exec prisma migrate deploy
pnpm exec prisma generate
# Reinicia next dev após generate
```

### 2. Configurar IA local

1. Entra na app → **Conta e perfil** → **Abrir configuração de IA** (ou `/perfil/ia`).
2. Confirma **Activar IA local**.
3. Endereço: `http://127.0.0.1:11434`.
4. **Modelo de ajuda:** `qwen2.5-coder:7b`.
5. **Testar ligação** → deve responder OK (modelos em falta listam-se se não estiverem no `ollama pull`).
6. **Guardar**.

### 3. Pedir ajuda contextual

1. Vai a qualquer página (ex.: **Despesas recorrentes**).
2. Clica no botão azul **?** (canto inferior direito).
3. Escolhe uma sugestão ou escreve a pergunta.
4. **Obter resposta** — demora ~10–30 s na primeira chamada do modelo.
5. Lê o texto; em baixo vês **Contexto: … · Modelo: …** e o aviso **Processado localmente**.

### 4. Exemplos de perguntas

| Pergunta | O que esperar |
|----------|----------------|
| Como anulo o pagamento de uma recorrência? | Histórico recente, reverte transação, repõe ocorrência |
| Como crio uma conta conjunta? | `/conta-conjunta`, convites, workspace JOINT |
| Qual é a diferença entre previsão e simulação? | Previsões = dados reais; simulações = hipóteses read-only |
| Como exporto um relatório? | `/relatorios`, datas De/Até, PDF/CSV |
| Onde altero a fotografia de perfil? | `/perfil`, URL HTTPS directo da imagem |

### 5. Ajuda vs Assistente

| | Ajuda **?** | Assistente `/assistente` |
|--|-------------|---------------------------|
| Dados | Documentação interna | Os teus totais e contas |
| BD | Não lê movimentos | Leitura autorizada |
| Uso | «Como funciona o botão X?» | «Quanto gastei em Alimentação?» |

### 6. Resolução de problemas

| Sintoma | Solução |
|---------|---------|
| Erro 500 ao pedir ajuda | `pnpm exec prisma generate` + reiniciar `next dev` |
| IA desactivada | `/perfil/ia` ou `FINTWIN_LOCAL_AI_ENABLED=0` no servidor |
| Resposta genérica longa | Fallback determinístico (Ollama offline ou timeout 45 s) |
| Modelo em falta | `ollama pull qwen2.5-coder:7b` |
