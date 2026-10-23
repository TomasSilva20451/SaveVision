#!/usr/bin/env bash
# Base backup para PITR (PostgreSQL). Requer archive_mode activo (ver docker-compose.pitr.yml).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p storage/backups/pitr/base storage/wal_archive
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="storage/backups/pitr/base/base-${STAMP}"

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx fintwin-postgres; then
  docker exec fintwin-postgres pg_basebackup -U fintwin -D /tmp/pitr-base -Ft -z -P
  docker cp "fintwin-postgres:/tmp/pitr-base/base.tar.gz" "${TARGET}.tar.gz"
  docker exec fintwin-postgres rm -rf /tmp/pitr-base
else
  if [[ -z "${DATABASE_URL:-}" && -f .env ]]; then set -a; source .env; set +a; fi
  # shellcheck disable=SC1091
  source "$(dirname "$0")/pg-url-for-cli.sh"
  PG_URL="$(pg_url_for_cli "$DATABASE_URL")"
  pg_basebackup -d "$PG_URL" -D "${TARGET}" -Ft -z -P
fi

echo "Base backup PITR: ${TARGET}.tar.gz (ou directório ${TARGET})"
echo "WAL arquivados em storage/wal_archive/ — combinar com pg_combinebackup / recovery conforme docs/BACKUP_RESTORE.md"
