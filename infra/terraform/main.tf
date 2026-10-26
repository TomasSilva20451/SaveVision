terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_db_instance" "postgres" {
  identifier                  = "fintwin-${var.environment}"
  engine                      = "postgres"
  engine_version              = "17"
  instance_class              = var.db_instance_class
  allocated_storage           = 50
  storage_encrypted           = true
  kms_key_id                  = aws_kms_key.fintwin.arn
  db_subnet_group_name        = aws_db_subnet_group.fintwin.name
  vpc_security_group_ids      = [aws_security_group.postgres.id]
  multi_az                    = var.environment == "production"
  publicly_accessible         = false
  backup_retention_period     = var.environment == "production" ? 14 : 3
  deletion_protection         = var.environment == "production"
  skip_final_snapshot         = false
  final_snapshot_identifier   = "fintwin-${var.environment}-final"
  db_name                     = "fintwin_${var.environment}"
  username                    = "fintwin"
  manage_master_user_password = true
}

resource "aws_s3_bucket" "documents" {
  bucket = "fintwin-${var.environment}-documents"
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.fintwin.arn
    }
    bucket_key_enabled = true
  }
}
