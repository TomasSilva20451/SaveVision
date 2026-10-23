#!/usr/bin/env bash
set -a
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
for f in .env.observability.local .env.production.local .env.backup.local .env; do
  if [[ -f "$f" ]]; then
    # shellcheck disable=SC1090
    source "$f"
  fi
done
set +a
