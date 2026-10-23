#!/usr/bin/env bash
# Instala entrada diária no crontab do utilizador (02:15 Europe/Lisbon ≈ 01:15 UTC no inverno).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_ENV="$ROOT/.env.backup.local"
MARKER="# fintwin-backup-cron"

if [[ ! -f "$LOCAL_ENV" ]]; then
  echo "Em falta .env.backup.local — executa: pnpm backup:setup" >&2
  exit 1
fi

LOG="${FINTWIN_BACKUP_LOG:-$HOME/Library/Logs/fintwin-backup.log}"
mkdir -p "$(dirname "$LOG")"

# Prefer node from PATH; backup-run is invoked via bash wrapper for env loading
CRON_LINE="15 1 * * * cd $ROOT && bash scripts/backup-cron-entrypoint.sh >> $LOG 2>&1 $MARKER"

EXISTING="$(crontab -l 2>/dev/null || true)"
FILTERED="$(echo "$EXISTING" | grep -v "$MARKER" | grep -v "fintwin-backup-cron" | grep -v "backup-cron-entrypoint" || true)"
{
  echo "$FILTERED"
  echo "$CRON_LINE"
} | sed '/^$/d' | crontab -

echo "Cron instalado (diário 01:15 UTC — ajusta TZ se necessário)."
echo "Log: $LOG"
echo "Teste manual: bash $ROOT/scripts/backup-cron-entrypoint.sh"
