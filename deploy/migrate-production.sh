#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-/opt/anton415-os/docker-compose.yml}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$(pwd)/migrations}"

if [ -n "${DATABASE_URL:-}" ]; then
  docker run --rm \
    -v "${MIGRATIONS_DIR}:/migrations:ro" \
    migrate/migrate:v4.18.3 \
    -path /migrations \
    -database "${DATABASE_URL}" \
    up
  exit 0
fi

if command -v docker >/dev/null 2>&1 && [ -f "${COMPOSE_FILE}" ]; then
  docker compose -f "${COMPOSE_FILE}" run --rm migrate
  exit 0
fi

echo "DATABASE_URL is required unless COMPOSE_FILE points to the production compose file" >&2
exit 64
