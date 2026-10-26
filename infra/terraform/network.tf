data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "postgres" {
  name        = "fintwin-${var.environment}-postgres"
  description = "PostgreSQL FinTwin ${var.environment}"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "PostgreSQL from VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "fintwin-${var.environment}-postgres"
  }
}

resource "aws_db_subnet_group" "fintwin" {
  name       = "fintwin-${var.environment}"
  subnet_ids = data.aws_subnets.default.ids

  tags = {
    Name = "fintwin-${var.environment}"
  }
}
