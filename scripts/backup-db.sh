#!/usr/bin/env bash
# Logical dump of schema split_the_wine → gzip → S3-compatible bucket.
# Intended for GitHub Actions daily cron (or local/manual runs).
#
# Required env:
#   DATABASE_URL
#   OBJECT_STORAGE_BUCKET
#   OBJECT_STORAGE_ENDPOINT
#   OBJECT_STORAGE_ACCESS_KEY_ID
#   OBJECT_STORAGE_SECRET_ACCESS_KEY
#
# Optional:
#   OBJECT_STORAGE_REGION          (default: auto)
#   OBJECT_STORAGE_FORCE_PATH_STYLE (true/1 → path-style)
#   DB_SCHEMA                     (default: split_the_wine)
#   BACKUP_PREFIX                 (default: db-backups)
#   BACKUP_RETENTION_DAYS         (default: 14)
#   AWS_EC2_METADATA_DISABLED=true is set below so the CLI never hits IMDS.

set -euo pipefail

SCHEMA="${DB_SCHEMA:-split_the_wine}"
PREFIX="${BACKUP_PREFIX:-db-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
if [[ -z "$RETENTION_DAYS" ]]; then RETENTION_DAYS=14; fi
REGION="${OBJECT_STORAGE_REGION:-auto}"
if [[ -z "$REGION" ]]; then REGION=auto; fi
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
KEY="${PREFIX}/${SCHEMA}/${STAMP}.sql.gz"

need() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env: $name" >&2
    exit 1
  fi
}

need DATABASE_URL
need OBJECT_STORAGE_BUCKET
need OBJECT_STORAGE_ENDPOINT
need OBJECT_STORAGE_ACCESS_KEY_ID
need OBJECT_STORAGE_SECRET_ACCESS_KEY

command -v pg_dump >/dev/null || { echo "pg_dump not found" >&2; exit 1; }
command -v aws >/dev/null || { echo "aws CLI not found" >&2; exit 1; }
command -v gzip >/dev/null || { echo "gzip not found" >&2; exit 1; }

export AWS_ACCESS_KEY_ID="$OBJECT_STORAGE_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$OBJECT_STORAGE_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$REGION"
export AWS_EC2_METADATA_DISABLED=true

S3_ARGS=(--endpoint-url "$OBJECT_STORAGE_ENDPOINT")
if [[ "${OBJECT_STORAGE_FORCE_PATH_STYLE:-}" == "1" || "${OBJECT_STORAGE_FORCE_PATH_STYLE:-}" == "true" ]]; then
  # Older Railway / some R2 setups
  aws configure set default.s3.addressing_style path
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
DUMP="$WORKDIR/dump.sql.gz"

echo "Dumping schema ${SCHEMA}…"
pg_dump "$DATABASE_URL" \
  --schema="$SCHEMA" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip -9 >"$DUMP"

BYTES="$(wc -c <"$DUMP" | tr -d ' ')"
echo "Upload s3://${OBJECT_STORAGE_BUCKET}/${KEY} (${BYTES} bytes)…"
aws s3 cp "$DUMP" "s3://${OBJECT_STORAGE_BUCKET}/${KEY}" "${S3_ARGS[@]}"

echo "Pruning backups older than ${RETENTION_DAYS} days under ${PREFIX}/${SCHEMA}/…"
CUTOFF="$(date -u -d "${RETENTION_DAYS} days ago" +%Y-%m-%dT%H%M%SZ 2>/dev/null \
  || date -u -v-"${RETENTION_DAYS}"d +%Y-%m-%dT%H%M%SZ)"

aws s3api list-objects-v2 \
  --bucket "$OBJECT_STORAGE_BUCKET" \
  --prefix "${PREFIX}/${SCHEMA}/" \
  "${S3_ARGS[@]}" \
  --query "Contents[?LastModified<='${CUTOFF}'].Key" \
  --output text \
  | tr '\t' '\n' \
  | while read -r old; do
      [[ -z "$old" || "$old" == "None" ]] && continue
      echo "Delete s3://${OBJECT_STORAGE_BUCKET}/${old}"
      aws s3 rm "s3://${OBJECT_STORAGE_BUCKET}/${old}" "${S3_ARGS[@]}"
    done

echo "Backup ok → s3://${OBJECT_STORAGE_BUCKET}/${KEY}"
