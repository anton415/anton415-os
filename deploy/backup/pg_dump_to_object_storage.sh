#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"

BACKUP_PREFIX="${BACKUP_PREFIX:-postgres}"
S3_ENDPOINT="${S3_ENDPOINT:-https://storage.yandexcloud.net}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORKDIR="$(mktemp -d)"
RUN_ID="${TIMESTAMP}-$(basename "${WORKDIR}")"
ARCHIVE="${WORKDIR}/anton415-os-${RUN_ID}.sql.gz"

cleanup() {
  rm -rf "${WORKDIR}"
}
trap cleanup EXIT

pg_dump "${DATABASE_URL}" | gzip -9 > "${ARCHIVE}"
aws --endpoint-url "${S3_ENDPOINT}" s3 cp "${ARCHIVE}" "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/monthly/anton415-os-${RUN_ID}.sql.gz"
