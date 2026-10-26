output "kms_key_arn" {
  value       = aws_kms_key.fintwin.arn
  description = "KMS principal do ambiente"
}

output "kms_alias" {
  value = aws_kms_alias.fintwin.name
}

output "documents_bucket" {
  value = aws_s3_bucket.documents.id
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.address
}

output "rds_master_user_secret_arn" {
  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
  description = "Secrets Manager com credenciais RDS (manage_master_user_password)"
}

output "app_secret_arns" {
  value = { for k, s in aws_secretsmanager_secret.app : k => s.arn }
}

output "redis_configuration_endpoint" {
  value       = var.enable_redis ? aws_elasticache_cluster.fintwin[0].cache_nodes[0].address : null
  description = "Host Redis (staging rate limit); URL completa em Secrets Manager redis-url"
}

output "audit_worm_bucket" {
  value       = aws_s3_bucket.audit_worm.id
  description = "Bucket S3 Object Lock para audit-events.jsonl (WORM)"
}
