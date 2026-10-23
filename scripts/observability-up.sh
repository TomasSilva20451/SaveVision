#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f secrets/prometheus_metrics_token ]]; then
  echo "Em falta secrets/prometheus_metrics_token — executa: pnpm observability:setup" >&2
  exit 1
fi

docker compose -f compose.observability.yml up -d
echo "Loki:     http://127.0.0.1:3100"
echo "Prometheus: http://127.0.0.1:9090 (target fintwin → host.docker.internal:3000)"
echo "OTEL:     http://127.0.0.1:4318"
echo "Grafana (opcional): docker run -d -p 3001:3000 grafana/grafana — datasource Loki http://loki:3100"
