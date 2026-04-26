#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

MIGRATIONS_DIR="${MIGRATIONS_DIR:-$(pwd)/migrations}"

docker run --rm \
  -v "${MIGRATIONS_DIR}:/migrations:ro" \
  migrate/migrate:v4.18.3 \
  -path /migrations \
  -database "${DATABASE_URL}" \
  up
