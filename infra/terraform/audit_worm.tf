resource "aws_s3_bucket" "audit_worm" {
  bucket              = "fintwin-${var.environment}-audit-worm"
  object_lock_enabled = true

  tags = {
    Name        = "fintwin-${var.environment}-audit-worm"
    Environment = var.environment
    Purpose     = "audit-jsonl-worm"
  }
}

resource "aws_s3_bucket_public_access_block" "audit_worm" {
  bucket                  = aws_s3_bucket.audit_worm.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "audit_worm" {
  bucket = aws_s3_bucket.audit_worm.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "audit_worm" {
  bucket = aws_s3_bucket.audit_worm.id

  rule {
    default_retention {
      mode = var.environment == "production" ? "COMPLIANCE" : "GOVERNANCE"
      days = var.audit_worm_retention_days
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_worm" {
  bucket = aws_s3_bucket.audit_worm.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.fintwin.arn
    }
    bucket_key_enabled = true
  }
}
