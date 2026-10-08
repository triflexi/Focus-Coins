#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
umask 077
dump="backups/focus-$(date -u +%Y%m%d-%H%M%S).dump"
docker compose -f compose.prod.yml --env-file .env --env-file current.env exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$dump.tmp"
mv "$dump.tmp" "$dump"
printf '%s\n' "$dump"
