variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Ambiente tem de ser staging ou production."
  }
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "enable_redis" {
  type        = bool
  description = "ElastiCache Redis para rate limit distribuído (staging recomendado)"
  default     = false
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "audit_worm_retention_days" {
  type        = number
  description = "Object Lock retention para export JSONL de auditoria"
  default     = 365
}
