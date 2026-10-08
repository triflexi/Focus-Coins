#!/bin/sh
set -eu
umask 077
mkdir -p /backups
name="/backups/focus-$(date -u +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --file="$name.tmp"
mv "$name.tmp" "$name"
# Only matching dump files in the explicit backup directory are rotated.
ls -1t /backups/focus-*.dump | tail -n +8 | while IFS= read -r old; do rm -- "$old"; done
