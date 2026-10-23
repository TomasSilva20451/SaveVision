# Plano de resposta a incidentes

Complementa runbooks técnicos (`docs/runbooks/`) e observabilidade (`docs/OBSERVABILITY.md`).

## Severidades

| Nível | Critério | Exemplo | Objetivo resposta |
|-------|----------|---------|-------------------|
| **P1** | App indisponível ou perda/ corrupção de dados | PostgreSQL down, tamper audit | 15 min acknowledge, 4 h mitigar |
| **P2** | Funcionalidade crítica degradada | Login em falha massiva, backups falham | 30 min acknowledge, 8 h mitigar |
| **P3** | Impacto limitado ou workaround | Ollama offline, export PDF lento | Próximo dia útil |
| **P4** | Cosmético / baixo risco | Copy UI, gráfico vazio pontual | Backlog |

## Papéis e contactos (FinTwin privado)

| Papel | Responsável | Contacto | Substituto |
|-------|-------------|----------|------------|
| **Incident Commander (IC)** | Tomás Silva | tomas@fintwin.local · Signal «FinTwin Ops» | Telmo Silva |
| **Tech Lead** | Telmo Silva | telmo@fintwin.local | Tomás Silva |
| **Comunicações** | Tomás Silva | tomas@fintwin.local | Telmo Silva |
| **Segurança** | Tomás Silva | tomas@fintwin.local | Telmo Silva |

**Canal interno:** thread Signal «FinTwin Ops» (ack P1 em 15 min).  
**Telemóvel / SMS de escalada:** guardar em cofre (`FINTWIN_IC_PHONE`, `FINTWIN_TL_PHONE`) — não commitar.

Manter cópia offline desta tabela + runbooks em `docs/runbooks/`.

## Fluxo (resumo)

1. **Deteção** — alerta (`ops:alert-check`), utilizador, health check, SIEM.
2. **Triagem** — IC assignado, severidade, canal (#incidentes ou equivalente).
3. **Contenção** — runbook componente (Postgres, storage, …).
4. **Resolução** — fix forward ou restore backup (ver `docs/BACKUP_RESTORE.md`).
5. **Recuperação** — validar SLO/jornadas, monitorizar 24 h.
6. **Post-mortem** — em **5 dias úteis** para P1/P2 (template abaixo).

## Comunicação

- **Interna:** estado a cada 30 min (P1) ou 2 h (P2).
- **Utilizadores:** mensagem curta pt-PT se dados ou disponibilidade afectados (Comunicações + IC).
- **Regulatório:** escalar a Segurança se exposição de dados pessoais.

## Exercícios simulados (game day)

| Exercício | Frequência | Objectivo |
|-----------|------------|-----------|
| Restore backup drill | Trimestral | `pnpm db:backup:drill` + CI |
| Postgres indisponível (tabletop) | Semestral | Runbook + IC |
| Perda volume documentos | Anual | Restore tarball |
| Webhook alertas | Mensal | `pnpm ops:alert-check` |

Registar data, participantes e acções em `docs/postmortems/YYYY-MM-DD-titulo.md`.

## Template post-mortem

```markdown
# Post-mortem: [título] — YYYY-MM-DD

## Resumo (2–3 frases)

## Impacto
- Severidade:
- Duração:
- Utilizadores afectados:
- SLO violado:

## Linha temporal (UTC)

## Causa raiz

## O que correu bem

## O que correu mal

## Acções (owner + prazo)
- [ ] …

## Lições aprendidas
```

## Integração SIEM

Ingerir logs JSON + métricas Prometheus + eventos `SecurityEvent`. Regras exemplo:

- Spike `auth.login` `result=failure`
- `health.status=critical`
- `audit.tamper-attempt-detected`

Ver `infra/siem/vector.toml.example`.
