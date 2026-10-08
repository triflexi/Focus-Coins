#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
dump="${1:?Pass an explicit backup file to restore}"
test -s "$dump"
# Run during a planned maintenance window; application history is replaced.
docker compose -f compose.prod.yml --env-file .env --env-file current.env stop api web
docker compose -f compose.prod.yml --env-file .env --env-file current.env exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$dump"
docker compose -f compose.prod.yml --env-file .env --env-file current.env up -d api web
