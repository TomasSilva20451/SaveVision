#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source "$ROOT/scripts/observability-load-env.sh"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
exec node "$ROOT/scripts/ops-alert-check.mjs"
