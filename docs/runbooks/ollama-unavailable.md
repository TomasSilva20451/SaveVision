# Runbook: Ollama indisponível

**Sintomas:** Sugestões de categorização vazias; narrativas PDF genéricas; botão «Explicar» com texto determinístico; `/api/health` pode continuar `ok`.

**Impacto:** Funcionalidade **opcional**. Registo manual, KPIs, alertas determinísticos e tesouraria **não** dependem do Ollama.

**RTO alvo:** best-effort (horas); **não bloqueia** operação financeira core.

## 1. Confirmar

```bash
curl -sS "${OLLAMA_BASE_URL:-http://127.0.0.1:11434}/api/tags"
```

Timeout ou connection refused → Ollama down ou URL incorrecta.

## 2. Recuperação local

```bash
ollama serve   # ou serviço systemd / Docker
ollama pull qwen3.5:4b-mlx   # modelo principal
```

Verificar em `/perfil/ia` → «Testar ligação».

## 3. App em produção (Docker)

- `OLLAMA_BASE_URL` aponta para host (`host.docker.internal:11434`) ou sidecar.
- Se Ollama corre noutro servidor: corrigir rede/firewall; **não** activar `OLLAMA_ALLOW_REMOTE` sem TLS e lista de IPs.

## 4. Modo degradado prolongado

- Definir `FINTWIN_LOCAL_AI_ENABLED=0` para desactivar chamadas (menos timeouts nos logs).
- Comunicar utilizadores: categorização e textos IA temporariamente indisponíveis.

## 5. Pós-incidente

- Confirmar fallbacks determinísticos nos fluxos críticos (E2E já não exige Ollama).
- Opcional: alerta externo no endpoint `/api/tags` se IA for requisito operacional interno.
