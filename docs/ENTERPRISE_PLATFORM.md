# Plataforma empresarial

A aplicação continua um monólito. Esta fase prepara a escala sem microserviços: infraestrutura descrita em código, dados isolados por ambiente, fila com limites e um backoffice de mínimo privilégio.

## Infraestrutura como código

`infra/terraform/` descreve, para `staging` e `production`:

- PostgreSQL 17 gerido, cifrado com **KMS** dedicado, subnet group e SG na VPC, sem IP público. Produção usa Multi-AZ, proteção contra apagamento e 14 dias de backups.
- Bucket S3 `fintwin-<ambiente>-documents` com bloqueio de acesso público e cifra `aws:kms`.
- **Secrets Manager** para auth, chaves de documentos/auditoria, backup e URL Redis (staging com `enable_redis`).
- **ElastiCache Redis** opcional (`enable_redis`) para rate limit distribuído.

Runbook: [`STAGING_KMS.md`](STAGING_KMS.md). CI: workflow `terraform-staging-plan.yml` (plan read-only em PR).

Aplicar é uma decisão operacional, com state remoto e credenciais fora do repositório:

```bash
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform plan -var-file=environments/staging.tfvars
```

O CI não corre `terraform apply`.

## Ambientes isolados

Cada ambiente tem base, bucket, chaves e volume de auditoria próprios. O nome do bucket tem de começar por `fintwin-staging-` ou `fintwin-production-`. A política de runtime já impede usar a base de outro ambiente.

## Objetos privados

Por omissão os documentos ficam no disco local, cifrados com `FTENC01`. Com `FINTWIN_OBJECT_STORAGE=s3` o mesmo envelope é enviado para o bucket:

- `FINTWIN_OBJECT_ENDPOINT`
- `FINTWIN_OBJECT_BUCKET`
- `FINTWIN_OBJECT_REGION`
- `FINTWIN_OBJECT_ACCESS_KEY_ID`
- `FINTWIN_OBJECT_SECRET_ACCESS_KEY`

A chave do objeto é `<ambiente>/<workspaceId>/<id>`.

## Fila e concorrência

`PlatformJob` aceita `REPORT_EXPORT`, `RECEIPT_OCR` e `ML_CATEGORIZATION`. O payload é fechado: não leva montantes nem ficheiros.

Limites: 2 relatórios, 1 OCR, 2 categorizações, 4 no total. `pnpm jobs:work` reclama um job de cada vez com compare-and-swap, valida o payload e marca sucesso. Uma falha volta à fila até `maxAttempts` e depois fica `FAILED`.

Os ecrãs de relatórios, recibos e categorização continuam síncronos. A fila é a fronteira para os mover para fora do pedido.

## Deploy gradual

O workflow **Gradual deploy check** recebe o URL HTTPS de saúde do candidato e a imagem anterior. `scripts/deploy-rollout.mjs` promove só com HTTP 2xx. Se a saúde falhar, o job termina em erro e indica a imagem a republicar. O rollback em si é o redeploy dessa imagem.

## Capacidade

`recommendReplicas` arredonda o pico de pedidos por segundo para cima e corta ao mínimo e máximo definidos. Produção começa em 2 réplicas; o tecto de referência é 6 até haver métricas reais em `/api/metrics`.

## Backoffice

`/backoffice` existe para `SUPPORT` e `ADMIN`.

| Capacidade | USER | SUPPORT | ADMIN |
| --- | --- | --- | --- |
| Abrir a fila | não | sim | sim |
| Repor um job falhado | não | não | sim |
| Ler movimentos ou documentos | não | não | não |

O papel `SUPPORT` não abre workspaces financeiros de outros utilizadores. A ligação só aparece em `/perfil` para quem tem um destes papéis.
