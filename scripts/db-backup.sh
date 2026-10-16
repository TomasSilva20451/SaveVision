#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p storage/backups
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="storage/backups/fintwin-${STAMP}.dump"
if [[ -z "${DATABASE_URL:-}" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
# shellcheck disable=SC1091
source "$(dirname "$0")/pg-url-for-cli.sh"
PG_URL="$(pg_url_for_cli "$DATABASE_URL")"

run_pg_dump() {
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx fintwin-postgres; then
    docker exec fintwin-postgres pg_dump -U fintwin -Fc fintwin > "$OUT"
    return
  fi
  pg_dump "$PG_URL" -Fc -f "$OUT"
}

if ! run_pg_dump; then
  echo "Falha no pg_dump. Se a BD corre em Docker (postgres:17), inicia o compose ou usa pg_dump 17 no host." >&2
  exit 1
fi
echo "Backup criado: $OUT"
