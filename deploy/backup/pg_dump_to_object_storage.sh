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
ARCHIVE="${WORKDIR}/anton415-os-${TIMESTAMP}.sql.gz"

cleanup() {
  rm -rf "${WORKDIR}"
}
trap cleanup EXIT

pg_dump "${DATABASE_URL}" | gzip -9 > "${ARCHIVE}"
aws --endpoint-url "${S3_ENDPOINT}" s3 cp "${ARCHIVE}" "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/daily/anton415-os-${TIMESTAMP}.sql.gz"

DAY_OF_MONTH="$(date -u +%d)"
if [ "${DAY_OF_MONTH}" = "01" ]; then
  aws --endpoint-url "${S3_ENDPOINT}" s3 cp "${ARCHIVE}" "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/monthly/anton415-os-${TIMESTAMP}.sql.gz"
fi
