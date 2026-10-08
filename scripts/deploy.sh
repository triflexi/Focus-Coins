#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
api="${1:?API image digest required}"; web="${2:?WEB image digest required}"; sha="${3:?Commit SHA required}"
[[ "$api" == *@sha256:* && "$web" == *@sha256:* ]] || { echo 'Use immutable image digests'; exit 2; }
umask 077
printf 'API_IMAGE=%s\nWEB_IMAGE=%s\nRELEASE_SHA=%s\n' "$api" "$web" "$sha" > next.env
if [[ -f current.env ]]; then bash scripts/backup.sh; cp current.env previous.env; fi
compose=(docker compose -f compose.prod.yml --env-file .env --env-file next.env)
"${compose[@]}" pull api web
"${compose[@]}" up -d --wait db
if [[ ! -f current.env ]]; then "${compose[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "backups-before-first-deploy.dump"; fi
"${compose[@]}" run --rm --no-deps api node prisma/cli.mjs migrate deploy
if "${compose[@]}" up -d --wait --wait-timeout 180; then
  domain=$(sed -n 's/^DOMAIN=//p' .env)
  if curl --fail --retry 12 --retry-delay 5 "https://$domain/health/ready" && curl --fail --retry 12 --retry-delay 5 "https://$domain/" >/dev/null; then
    mv next.env current.env
    printf '{"sha":"%s","api":"%s","web":"%s"}\n' "$sha" "$api" "$web" > current-version.json
    exit 0
  fi
fi
echo 'Health checks failed; rolling back application images.'
if [[ -f previous.env ]]; then bash scripts/rollback.sh; fi
exit 1
