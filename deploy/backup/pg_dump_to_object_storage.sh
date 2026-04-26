#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"

BACKUP_PREFIX="${BACKUP_PREFIX:-postgres}"
BACKUP_COMPOSE_FILE="${BACKUP_COMPOSE_FILE:-/opt/anton415-os/docker-compose.yml}"
S3_ENDPOINT="${S3_ENDPOINT:-https://storage.yandexcloud.net}"
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ru-central1}"
export AWS_DEFAULT_REGION
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORKDIR="$(mktemp -d)"
RUN_ID="${TIMESTAMP}-$(basename "${WORKDIR}")"
ARCHIVE="${WORKDIR}/anton415-os-${RUN_ID}.sql.gz"

cleanup() {
  rm -rf "${WORKDIR}"
}
trap cleanup EXIT

dump_database() {
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "${DATABASE_URL}"
    return
  fi

  if command -v docker >/dev/null 2>&1 && [ -f "${BACKUP_COMPOSE_FILE}" ]; then
    docker compose -f "${BACKUP_COMPOSE_FILE}" exec -T postgres pg_dump "${DATABASE_URL}"
    return
  fi

  echo "pg_dump is not available and Docker Compose fallback cannot be used" >&2
  return 1
}

upload_archive() {
  destination="s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/monthly/anton415-os-${RUN_ID}.sql.gz"
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
