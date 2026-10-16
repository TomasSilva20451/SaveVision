#!/usr/bin/env bash
# pg_dump/pg_restore não aceitam ?schema= (parâmetro Prisma). Remove query string.
pg_url_for_cli() {
  local url="$1"
  echo "${url%%\?*}"
}
