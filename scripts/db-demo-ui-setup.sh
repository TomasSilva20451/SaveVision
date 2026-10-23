#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_NAME="${FINTWIN_DEMO_UI_DATABASE:-fintwin_demo_ui}"
BASE_URL="${FINTWIN_DEMO_DATABASE_URL:-postgresql://fintwin:fintwin@localhost:5433/${DB_NAME}?schema=public}"
DB_NAME="$(node -e 'console.log(new URL(process.argv[1]).pathname.slice(1))' "$BASE_URL")"

echo "==> Destino: ${DB_NAME} (localhost:5433)"
echo "    A base principal «fintwin» NÃO será alterada."

node scripts/provision-postgres-database.mjs "$DB_NAME"

FINTWIN_ENV=demo DATABASE_URL="$BASE_URL" pnpm exec prisma migrate deploy
FINTWIN_ENV=demo FINTWIN_SEED_PROFILE=demo DATABASE_URL="$BASE_URL" pnpm exec prisma db seed

echo "==> Demo UI pronta. Para desenvolvimento:"
echo "    DATABASE_URL=\"${BASE_URL}\" pnpm dev"
echo "    ou: pnpm dev:demo"
