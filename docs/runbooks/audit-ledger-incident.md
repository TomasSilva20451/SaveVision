# Runbook — ledger de auditoria e adulteração

## Sintomas

- `/api/health` responde **503** com `audit: tamper-attempt-detected`.
- `pnpm audit:verify` falha (`CHAIN_BREAK`, `HASH_MISMATCH`, `SIGNATURE_MISMATCH`).
- Alertas SIEM/`ops:alert-check` sobre health crítico.

## O que significa

PostgreSQL bloqueia `UPDATE`/`DELETE` em `AuditEvent` e regista tentativas em `AuditTamperAttempt`. Cada evento válido tem `previousHash`, `eventHash` e assinatura HMAC; cópia append-only em `storage/audit/<ambiente>/audit-events.jsonl` (volume separado em staging/produção).

## Resposta imediata

1. **Não** restaurar a base operacional sem preservar o volume de auditoria e backups off-site.
2. Exportar provas: `AuditTamperAttempt`, últimos eventos `AuditEvent`, ficheiro JSONL e logs de acesso à BD.
3. Escalar conforme `docs/INCIDENT_RESPONSE.md` (severidade alta — integridade forense).
4. Rotacionar credenciais de administração PostgreSQL se a tentativa vier de acesso privilegiado.

## Verificação

```bash
pnpm audit:verify
```

Comparar sequência e hashes com o arquivo JSONL e com o último backup cifrado (`docs/BACKUP_RESTORE.md`).

## Recuperação

- **Cadeia intacta, tentativa isolada:** manter registos; investigar origem; health volta a OK quando `AuditTamperAttempt` for analisado (não se apaga — documentar decisão).
- **Cadeia quebrada na base mas JSONL intacto:** tratar a base como comprometida; reconstruir procedimento forense a partir do arquivo + backups; envolver responsável de segurança antes de reimportar.
- **Rotação de chave de assinatura:** nova `FINTWIN_AUDIT_SIGNING_KEY` + `FINTWIN_AUDIT_SIGNING_KEY_ID`; manter chave antiga no cofre até expirar retenção dos eventos assinados com ela.

## Prevenção operacional

- Staging/produção: `FINTWIN_AUDIT_ARCHIVE_REQUIRED=1`, IDs de chave `staging-*` / `production-*`, TLS e segredos por ficheiro (`runtime-entrypoint`).
- Incluir volume `fintwin_*_audit` no backup off-site; retenção ≥ política de compliance.
