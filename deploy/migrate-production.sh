#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-/opt/anton415-hub/docker-compose.yml}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$(pwd)/migrations}"
APP_ENV_FILE="${APP_ENV_FILE:-/opt/anton415-hub/app.env}"
SECRETS_FILE="${SECRETS_FILE:-/opt/anton415-hub/secrets.env}"

read_env() {
  file="$1"
  key="$2"
  [ -f "$file" ] || return 1
  awk -F= -v key="$key" '
    $1 == key {
      sub(/^[^=]*=/, "")
      print
      found = 1
      exit
    }
    END { exit found ? 0 : 1 }
  ' "$file"
}

require_env() {
  file="$1"
  key="$2"
  value="$(read_env "$file" "$key" || true)"
  if [ -z "$value" ]; then
    echo "$key is required in $file" >&2
    exit 64
  fi
  printf '%s' "$value"
}

database_url_from_env_files() {
  db_user="$(require_env "$APP_ENV_FILE" POSTGRES_USER)"
  db_name="$(require_env "$APP_ENV_FILE" POSTGRES_DB)"
  db_host="$(read_env "$APP_ENV_FILE" POSTGRES_HOST || printf '%s' postgres)"
  db_port="$(read_env "$APP_ENV_FILE" POSTGRES_PORT || printf '%s' 5432)"

  python3 - "$db_user" "$db_host" "$db_port" "$db_name" <<'PY'
import sys
from urllib.parse import quote

user, host, port, name = sys.argv[1:]
print(f"postgres://{quote(user)}@{host}:{port}/{quote(name)}?sslmode=disable")
PY
}

run_migrate() {
  database_url="$1"
  if [ -n "${PGPASSWORD:-}" ]; then
    export PGPASSWORD
  fi

  if command -v docker >/dev/null 2>&1 && [ -f "${COMPOSE_FILE}" ]; then
    docker compose -f "${COMPOSE_FILE}" run --rm -e PGPASSWORD migrate \
      -path /migrations \
      -database "${database_url}" \
      up
    exit 0
  fi

  docker run --rm \
    -v "${MIGRATIONS_DIR}:/migrations:ro" \
    -e PGPASSWORD \
    migrate/migrate:v4.18.3 \
    -path /migrations \
    -database "${database_url}" \
    up
  exit 0
}

if [ -n "${DATABASE_URL:-}" ]; then
  if [ -z "${PGPASSWORD:-}" ]; then
    PGPASSWORD="$(read_env "$SECRETS_FILE" POSTGRES_PASSWORD || true)"
  fi
  run_migrate "${DATABASE_URL}"
fi

if command -v docker >/dev/null 2>&1 && [ -f "${COMPOSE_FILE}" ]; then
  PGPASSWORD="$(require_env "$SECRETS_FILE" POSTGRES_PASSWORD)"
  run_migrate "$(database_url_from_env_files)"
fi

echo "DATABASE_URL is required unless COMPOSE_FILE points to the production compose file with app.env and secrets.env" >&2
exit 64
