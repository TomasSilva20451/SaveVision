# Rotação de chaves (KMS / Secrets Manager)

Alinha com R4 e `docs/STAGING_KMS.md`.

## Chaves FinTwin

| Segredo | Onde | Periodicidade |
|---------|------|---------------|
| `AUTH_SECRET` | Secrets Manager `fintwin/<env>/auth-secret` | 90 dias ou incidente |
| Documentos | `document-encryption-key` | Anual + KMS rotation |
| Auditoria HMAC | `audit-signing-key` | Anual |
| Backup GCM | `backup-encryption-secret` | Anual |
| RDS master | Segredo gerido RDS | AWS automático |

## Procedimento (staging primeiro)

1. Gerar novo valor (`openssl rand -base64 32`).
2. `aws secretsmanager put-secret-value --secret-id ... --secret-string ...`
3. `pnpm infra:render-staging-secrets --out-dir /etc/fintwin/staging`
4. Rolling restart da app; validar login, download documento, export PDF.
5. Para chaves de documentos: **não** re-encriptar histórico no mesmo passo — planear job offline se `keyId` mudar.

## KMS CMK

Terraform: `aws_kms_key.fintwin` com `enable_key_rotation = true`. Drill trimestral: confirmar alias `alias/fintwin-<env>` na consola.

## Evidência

Registar data, owner e ticket no tracker interno; anexar output de `terraform output kms_key_arn`.
