resource "aws_security_group" "redis" {
  count = var.enable_redis ? 1 : 0

  name        = "fintwin-${var.environment}-redis"
  description = "Redis FinTwin ${var.environment} (rate limit / sessões)"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Redis from VPC"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_elasticache_subnet_group" "fintwin" {
  count      = var.enable_redis ? 1 : 0
  name       = "fintwin-${var.environment}"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_elasticache_cluster" "fintwin" {
  count = var.enable_redis ? 1 : 0

  cluster_id           = "fintwin-${var.environment}"
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.1"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.fintwin[0].name
  security_group_ids   = [aws_security_group.redis[0].id]

  tags = {
    Name        = "fintwin-${var.environment}"
    Environment = var.environment
  }
}
