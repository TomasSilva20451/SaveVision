locals {
  secret_names = {
    auth_secret     = "fintwin/${var.environment}/auth-secret"
    document_key    = "fintwin/${var.environment}/document-encryption-key"
    audit_key       = "fintwin/${var.environment}/audit-signing-key"
    backup_key      = "fintwin/${var.environment}/backup-encryption-secret"
    redis_url       = "fintwin/${var.environment}/redis-url"
  }
}

resource "aws_secretsmanager_secret" "app" {
  for_each = local.secret_names

  name                    = each.value
  description             = "FinTwin ${var.environment} — ${each.key}"
  kms_key_id              = aws_kms_key.fintwin.arn
  recovery_window_in_days = var.environment == "production" ? 30 : 7

  tags = {
    Environment = var.environment
    SecretKind  = each.key
  }
}

# Versões iniciais vazias/placeholder — rotação manual ou scripts/render-staging-secrets-from-aws.mjs
resource "aws_secretsmanager_secret_version" "app_placeholder" {
  for_each = aws_secretsmanager_secret.app

  secret_id     = each.value.id
  secret_string = "REPLACE_VIA_OPS_ROTATION"

  lifecycle {
    ignore_changes = [secret_string]
  }
}
