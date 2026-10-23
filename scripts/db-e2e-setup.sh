#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_NAME="${FINTWIN_E2E_DATABASE:-fintwin_e2e}"
BASE_URL="${FINTWIN_E2E_DATABASE_URL:-postgresql://fintwin:fintwin@localhost:5433/${DB_NAME}?schema=public}"
DB_NAME="$(node -e 'console.log(new URL(process.argv[1]).pathname.slice(1))' "$BASE_URL")"

echo "==> Destino: ${DB_NAME} (localhost:5433)"

if [[ "${FINTWIN_SKIP_DATABASE_PROVISION:-0}" != "1" ]]; then
  node scripts/provision-postgres-database.mjs "$DB_NAME"
fi

FINTWIN_ENV=e2e DATABASE_URL="$BASE_URL" pnpm exec prisma migrate deploy
FINTWIN_ENV=e2e FINTWIN_SEED_PROFILE=e2e DATABASE_URL="$BASE_URL" pnpm exec prisma db seed

echo "==> Base E2E pronta."
echo "    DATABASE_URL=\"${BASE_URL}\" FINTWIN_ALLOW_E2E_CLEANUP=yes pnpm test:e2e"
