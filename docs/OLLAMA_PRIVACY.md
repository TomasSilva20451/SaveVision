# Privacidade — Ollama e prompts

## O que pode sair do FinTwin

- Descrições de movimentos, montantes, categorias disponíveis, exemplos confirmados (categorização).
- Texto de ajuda e rota actual (ajuda contextual).
- Evidência JSON já calculada (alertas/insights) para reescrita.
- Imagem de recibo (visão) — **nunca** enviada a serviços cloud FinTwin.

Ver detalhe por funcionalidade: `LOCAL_ML_CATEGORIZATION.md`, `CONTEXTUAL_HELP.md`, `RECEIPT_SCAN.md`.

## O que não enviamos

- Palavras-passe, TOTP, tokens sessão.
- Chaves API (não existem para Ollama).
- Base de dados completa ou exports.

## Consentimentos

| Chave | Obrigatório para |
|-------|------------------|
| `local_ai_processing` | Activar IA em `/perfil/ia` |
| `prompt_storage` | `storePrompts=true` |

Registo no Centro de Privacidade (`/perfil/privacidade`).

## Retenção de prompts

- **`storePrompts=false`:** sem histórico persistente de perguntas (sessão apenas).
- **`storePrompts=true`:** retenção alvo **7 dias** (política; implementação de purge pode ser fase seguinte).
- Cache de sugestões batch: ~10 min (`LOCAL_ML_CATEGORIZATION.md`).

## Controlos utilizador

- Desactivar IA local globalmente (`FINTWIN_LOCAL_AI_ENABLED=0`) ou por utilizador.
- Escolher modelos e URL (localhost).
- Revogar consentimento no centro de privacidade (desactiva novas chamadas após save).

## Processador

O **Ollama no teu hardware** actua como subprocessador local; FinTwin não controla logs do daemon Ollama — recomenda-se disco encriptado no portátil/servidor.

## Roadmap relay (deploy público → Ollama no Mac)

**Não implementado.** O FinTwin na Vercel nunca deve abrir o Ollama do utilizador via `127.0.0.1` no browser ou no servidor cloud.

Direcção futura (cifrada e autenticada):

1. **Agente local** no Mac (ou LAN) com token de curta duração ou par de chaves; rotação e revogação no centro de segurança.
2. **Túnel TLS** (WireGuard, Cloudflare Tunnel, ou relay dedicado) — nunca expor a API Ollama directamente à Internet.
3. **Contrato** `LocalAiRelayProvider` em `src/server/providers/contracts.ts`, activo só com `FINTWIN_OLLAMA_RELAY_URL` + credencial; substitui `fetch` directo em `ollama-config.ts`.
4. **Consentimento RGPD** separado do relay (além de `local_ai_processing`).

Até lá: produção local loopback (`pnpm setup:production:local`) ou deploy público sem IA generativa local.
