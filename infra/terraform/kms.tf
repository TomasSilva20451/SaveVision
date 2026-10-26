resource "aws_kms_key" "fintwin" {
  description             = "FinTwin ${var.environment} — RDS, S3, Secrets Manager"
  deletion_window_in_days = var.environment == "production" ? 30 : 7
  enable_key_rotation     = true

  tags = {
    Name        = "fintwin-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_kms_alias" "fintwin" {
  name          = "alias/fintwin-${var.environment}"
  target_key_id = aws_kms_key.fintwin.key_id
}
