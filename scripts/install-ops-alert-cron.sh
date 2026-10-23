#!/usr/bin/env bash
# Alertas operacionais de hora a hora.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_ENV="$ROOT/.env.observability.local"
MARKER="# fintwin-ops-alert-cron"

if [[ ! -f "$LOCAL_ENV" ]]; then
  echo "Em falta .env.observability.local — executa: pnpm observability:setup" >&2
  exit 1
fi

LOG="${FINTWIN_OPS_ALERT_LOG:-$HOME/Library/Logs/fintwin-ops-alert.log}"
mkdir -p "$(dirname "$LOG")"

CRON_LINE="0 * * * * cd $ROOT && bash scripts/ops-alert-entrypoint.sh >> $LOG 2>&1 $MARKER"

EXISTING="$(crontab -l 2>/dev/null || true)"
FILTERED="$(echo "$EXISTING" | grep -v "$MARKER" | grep -v "fintwin-ops-alert" | grep -v "ops-alert-entrypoint" || true)"
{
  echo "$FILTERED"
  echo "$CRON_LINE"
} | sed '/^$/d' | crontab -

echo "Cron ops:alert-check instalado (de hora a hora, minuto 0 UTC)."
echo "Log: $LOG"
echo "Teste: bash $ROOT/scripts/ops-alert-entrypoint.sh"
