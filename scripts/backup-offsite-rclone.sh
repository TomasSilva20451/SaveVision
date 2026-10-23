#!/usr/bin/env bash
# Envia um ficheiro de backup para remoto rclone (off-site).
# Invocado via FINTWIN_BACKUP_OFFSITE_COMMAND; recebe caminho em $1 ou $FILE.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export RCLONE_CONFIG="${RCLONE_CONFIG:-$ROOT/.rclone.conf}"
FILE="${1:-${FILE:-}}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "backup-offsite-rclone: ficheiro em falta ($FILE)" >&2
  exit 1
fi
REMOTE="${FINTWIN_RCLONE_REMOTE:?Define FINTWIN_RCLONE_REMOTE (ex.: fintwin-offsite)}"
PREFIX="${FINTWIN_RCLONE_PREFIX:-fintwin/backups}"
FALLBACK_ROOT="${FINTWIN_OFFSITE_FALLBACK_DIR:-$HOME/FinTwin-backups-offsite}"
if ! command -v rclone >/dev/null 2>&1; then
  DEST_DIR="${FALLBACK_ROOT}/${PREFIX}/"
  mkdir -p "$DEST_DIR"
  echo "[off-site fallback] cp -> ${DEST_DIR}$(basename "$FILE") (instala rclone para S3/B2)"
  cp -p "$FILE" "${DEST_DIR}/"
  exit 0
fi
DEST="${REMOTE}:${PREFIX}/$(basename "$FILE")"
echo "[rclone] copy -> ${DEST}"
rclone copyto "$FILE" "$DEST" --immutable --stats-one-line
echo "[rclone] OK"
