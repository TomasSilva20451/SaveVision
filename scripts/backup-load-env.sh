#!/usr/bin/env bash
# Carrega variáveis para backup (cron / CLI). Ordem: backup → produção → dev.
set -a
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
for f in .env.backup.local .env.production.local .env; do
  if [[ -f "$f" ]]; then
    # shellcheck disable=SC1090
    source "$f"
  fi
done
set +a
