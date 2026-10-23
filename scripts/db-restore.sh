#!/usr/bin/env bash
set -euo pipefail
if [[ $# -lt 1 ]]; then
  echo "Uso: pnpm db:restore <ficheiro.dump> [DATABASE_URL_alvo]"
  exit 1
fi
# shellcheck disable=SC1091
source "$(dirname "$0")/backup-load-env.sh"
FILE="$1"
TARGET="${2:-${FINTWIN_RESTORE_DATABASE_URL:-}}"
if [[ -z "$TARGET" ]]; then
  echo "Define FINTWIN_RESTORE_DATABASE_URL ou passa URL como 2.º argumento."
  exit 1
fi
# shellcheck disable=SC1091
source "$(dirname "$0")/pg-url-for-cli.sh"
if [[ -n "${FINTWIN_BACKUP_ENCRYPTION_SECRET_FILE:-}" && -z "${FINTWIN_BACKUP_ENCRYPTION_SECRET:-}" ]]; then
  export FINTWIN_BACKUP_ENCRYPTION_SECRET="$(tr -d '\r\n' < "$FINTWIN_BACKUP_ENCRYPTION_SECRET_FILE")"
fi
MAIN_URL="$(pg_url_for_cli "${DATABASE_URL:-}")"
TARGET_URL="$(pg_url_for_cli "$TARGET")"
if [[ -n "$MAIN_URL" && "$TARGET_URL" == "$MAIN_URL" && "${FINTWIN_RESTORE_CONFIRM:-}" != "yes" ]]; then
  echo "Bloqueado: o alvo coincide com DATABASE_URL principal."
  echo "Para restaurar sobre a base principal (perigoso), define FINTWIN_RESTORE_CONFIRM=yes."
  exit 2
fi
if [[ ! -f "$FILE" ]]; then
  echo "Ficheiro não encontrado: $FILE"
  exit 1
fi
RESTORE_FILE="$FILE"
DECRYPTED_FILE=""
if [[ "$FILE" == *.enc ]]; then
  DECRYPTED_FILE="$(mktemp "${TMPDIR:-/tmp}/fintwin-restore.XXXXXX.dump")"
  trap 'rm -f "$DECRYPTED_FILE"' EXIT
  node "$(dirname "$0")/backup-crypto.mjs" decrypt "$FILE" "$DECRYPTED_FILE"
  RESTORE_FILE="$DECRYPTED_FILE"
fi
echo "A restaurar $FILE para base temporária/alvo indicada..."

run_pg_restore() {
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx fintwin-postgres; then
    local db_name
    db_name="$(echo "$TARGET_URL" | sed -E 's|.*/||')"
    docker cp "$RESTORE_FILE" fintwin-postgres:/tmp/fintwin-restore.dump
    docker exec fintwin-postgres pg_restore --clean --if-exists --no-owner -U fintwin -d "$db_name" /tmp/fintwin-restore.dump
    docker exec fintwin-postgres rm -f /tmp/fintwin-restore.dump
    return
  fi
  pg_restore --clean --if-exists --no-owner --dbname="$TARGET_URL" "$RESTORE_FILE"
}

if ! run_pg_restore; then
  echo "Falha no pg_restore. Usa pg_restore 17 ou Docker (contentor fintwin-postgres)." >&2
  exit 1
fi
echo "Restore concluído."
