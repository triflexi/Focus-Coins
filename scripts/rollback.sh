#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -s previous.env
cp previous.env current.env
docker compose -f compose.prod.yml --env-file .env --env-file current.env up -d --wait --wait-timeout 180 api web
set -a
source current.env
set +a
printf '{"sha":"%s","api":"%s","web":"%s"}\n' "$RELEASE_SHA" "$API_IMAGE" "$WEB_IMAGE" > current-version.json
echo 'Previous application images restored. Database was not restored.'
