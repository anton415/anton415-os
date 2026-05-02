#!/usr/bin/env sh
set -eu

BACKUP_PREFIX="${BACKUP_PREFIX:-postgres}"
BACKUP_COMPOSE_FILE="${BACKUP_COMPOSE_FILE:-/opt/anton415-hub/docker-compose.yml}"
APP_ENV_FILE="${APP_ENV_FILE:-/opt/anton415-hub/app.env}"
SECRETS_FILE="${SECRETS_FILE:-/opt/anton415-hub/secrets.env}"
S3_ENDPOINT="${S3_ENDPOINT:-https://storage.yandexcloud.net}"
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ru-central1}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORKDIR="$(mktemp -d)"
RUN_ID="${TIMESTAMP}-$(basename "${WORKDIR}")"
ARCHIVE="${WORKDIR}/anton415-hub-${RUN_ID}.sql.gz"

cleanup() {
  rm -rf "${WORKDIR}"
}
trap cleanup EXIT

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

runtime_value() {
  key="$1"
  file="$2"
  value="$(printenv "$key" || true)"
  if [ -z "$value" ]; then
    value="$(read_env "$file" "$key" || true)"
  fi
  printf '%s' "$value"
}

require_runtime_value() {
  key="$1"
  file="$2"
  value="$(runtime_value "$key" "$file")"
  if [ -z "$value" ]; then
    echo "$key is required in the environment or $file" >&2
    exit 64
  fi
  printf '%s' "$value"
}

database_url_from_runtime() {
  db_user="$(runtime_value POSTGRES_USER "$APP_ENV_FILE")"
  db_name="$(runtime_value POSTGRES_DB "$APP_ENV_FILE")"
  db_host="$(runtime_value POSTGRES_HOST "$APP_ENV_FILE")"
  db_port="$(runtime_value POSTGRES_PORT "$APP_ENV_FILE")"

  db_user="${db_user:-anton415_hub_app}"
  db_name="${db_name:-anton415_hub}"
  db_host="${db_host:-postgres}"
  db_port="${db_port:-5432}"

  python3 - "$db_user" "$db_host" "$db_port" "$db_name" <<'PY'
import sys
from urllib.parse import quote

user, host, port, name = sys.argv[1:]
print(f"postgres://{quote(user)}@{host}:{port}/{quote(name)}?sslmode=disable")
PY
}

if [ -z "${DATABASE_URL:-}" ]; then
  PGPASSWORD="$(require_runtime_value POSTGRES_PASSWORD "$SECRETS_FILE")"
  DATABASE_URL="$(database_url_from_runtime)"
elif [ -z "${PGPASSWORD:-}" ]; then
  PGPASSWORD="$(runtime_value POSTGRES_PASSWORD "$SECRETS_FILE")"
fi
BACKUP_BUCKET="${BACKUP_BUCKET:-$(require_runtime_value BACKUP_BUCKET "$APP_ENV_FILE")}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-$(require_runtime_value AWS_ACCESS_KEY_ID "$SECRETS_FILE")}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-$(require_runtime_value AWS_SECRET_ACCESS_KEY "$SECRETS_FILE")}"
export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION
if [ -n "${PGPASSWORD:-}" ]; then
  export PGPASSWORD
fi

dump_database() {
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "${DATABASE_URL}"
    return
  fi

  if command -v docker >/dev/null 2>&1 && [ -f "${BACKUP_COMPOSE_FILE}" ]; then
    docker compose -f "${BACKUP_COMPOSE_FILE}" exec -T -e PGPASSWORD postgres pg_dump "${DATABASE_URL}"
    return
  fi

  echo "pg_dump is not available and Docker Compose fallback cannot be used" >&2
  return 1
}

upload_archive() {
  destination="s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/monthly/anton415-hub-${RUN_ID}.sql.gz"
  if command -v aws >/dev/null 2>&1; then
    aws --endpoint-url "${S3_ENDPOINT}" s3 cp "${ARCHIVE}" "${destination}"
    return
  fi

  if command -v docker >/dev/null 2>&1; then
    docker run --rm \
      -e AWS_ACCESS_KEY_ID \
      -e AWS_SECRET_ACCESS_KEY \
      -e AWS_DEFAULT_REGION \
      -v "${WORKDIR}:/backup:ro" \
      amazon/aws-cli:2.17.43 \
      --endpoint-url "${S3_ENDPOINT}" \
      s3 cp "/backup/$(basename "${ARCHIVE}")" "${destination}"
    return
  fi

  echo "aws CLI is not available and Docker AWS CLI fallback cannot be used" >&2
  return 1
}

dump_database | gzip -9 > "${ARCHIVE}"
upload_archive
