# Staging — Terraform, KMS e segredos

Infra mínima em `infra/terraform/` para **staging** (eu-west-1): RDS PostgreSQL encriptado com KMS, bucket S3 documentos com `aws:kms`, Secrets Manager para chaves da app, Redis opcional para rate limit (`FINTWIN_REDIS_URL`).

## Pré-requisitos

- Terraform ≥ 1.6, credenciais AWS com permissões RDS/S3/KMS/Secrets Manager/ElastiCache
- VPC default na região (subnet group usa subnets da VPC default)

## Aplicar staging

```bash
cd infra/terraform
terraform init
terraform plan -var-file=environments/staging.tfvars
terraform apply -var-file=environments/staging.tfvars
```

## Outputs relevantes

| Output | Uso |
|--------|-----|
| `kms_key_arn` | Políticas IAM, auditoria |
| `rds_master_user_secret_arn` | URL PostgreSQL (Secrets Manager) |
| `app_secret_arns` | Auth, document/audit keys, backup, redis-url |
| `redis_configuration_endpoint` | Host ElastiCache (porta 6379) |
| `documents_bucket` | Armazenamento documentos |

## Montagem no contentor (`*_FILE`)

Alinhar com `.env.staging.example`:

| Ficheiro no host | Segredo |
|------------------|---------|
| `/etc/fintwin/staging/database-url` | `DATABASE_URL` (compor a partir do segredo RDS) |
| `/etc/fintwin/staging/auth-secret` | `AUTH_SECRET` |
| `/etc/fintwin/staging/document-key` | `FINTWIN_DOCUMENT_ENCRYPTION_KEY` |
| `/etc/fintwin/staging/audit-key` | `FINTWIN_AUDIT_SIGNING_KEY` |

Script auxiliar (requer AWS CLI):

```bash
pnpm infra:render-staging-secrets --out-dir /etc/fintwin/staging
```

Define `FINTWIN_REDIS_URL` a partir do segredo `redis-url` após popular `redis://<endpoint>:6379`.

## Rotação

1. Gerar novo valor (openssl ou rotação nativa RDS).
2. `aws secretsmanager put-secret-value --secret-id <arn> --secret-string ...`
3. Redeploy da app; KMS com rotação automática anual.

## CI

Workflow `terraform-staging-plan.yml` corre `fmt`, `validate` e `plan` em PRs que tocam `infra/terraform/`. Credenciais opcionais: `AWS_PLAN_ACCESS_KEY_ID` / `AWS_PLAN_SECRET_ACCESS_KEY`.

## Produção

Usar `environments/production.tfvars` (`enable_redis` conforme necessidade). `multi_az` e retenção de backups mais longa já estão condicionados em `main.tf`.
