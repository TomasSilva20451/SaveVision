#!/usr/bin/env bash
# Executa psql/pg com Docker (fintwin-postgres) ou cliente local.
set -euo pipefail
SQL="${1:?SQL em falta}"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx fintwin-postgres; then
  docker exec fintwin-postgres psql -U fintwin -d postgres -v ON_ERROR_STOP=1 -c "$SQL"
  exit 0
fi
if [[ -z "${DATABASE_URL:-}" && -f .env ]]; then set -a; source .env; set +a; fi
# shellcheck disable=SC1091
source "$(dirname "$0")/pg-url-for-cli.sh"
ADMIN="$(pg_url_for_cli "$DATABASE_URL")"
ADMIN="${ADMIN%/*}/postgres"
psql "$ADMIN" -v ON_ERROR_STOP=1 -c "$SQL"
