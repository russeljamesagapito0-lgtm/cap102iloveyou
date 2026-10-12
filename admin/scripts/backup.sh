#!/usr/bin/env bash
# Weekly Supabase backup. Needs SUPABASE_DB_URL and BACKUP_PASSPHRASE.
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is not set}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"

OUT_DIR="${OUT_DIR:-backups}"
STAMP="$(date -u +%Y-%m-%d)"
NAME="rootcare-backup-${STAMP}"
mkdir -p "$OUT_DIR"

# public schema (tables, policies, functions, data)
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges \
  --file="$OUT_DIR/${NAME}-public.sql"

# auth.users, needed to restore profiles (FK to auth.users)
pg_dump "$SUPABASE_DB_URL" --table=auth.users --data-only --column-inserts \
  --no-owner --no-privileges --file="$OUT_DIR/${NAME}-auth-users.sql"

# sanity check: refuse to ship an empty dump
grep -q "CREATE TABLE public.scans" "$OUT_DIR/${NAME}-public.sql" \
  || { echo "Dump looks empty, aborting" >&2; exit 1; }

tar -C "$OUT_DIR" -czf "$OUT_DIR/${NAME}.tar.gz" \
  "${NAME}-public.sql" "${NAME}-auth-users.sql"

gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 \
  --passphrase "$BACKUP_PASSPHRASE" \
  --output "$OUT_DIR/${NAME}.tar.gz.gpg" "$OUT_DIR/${NAME}.tar.gz"

# plaintext never leaves the runner
rm -f "$OUT_DIR/${NAME}-public.sql" "$OUT_DIR/${NAME}-auth-users.sql" "$OUT_DIR/${NAME}.tar.gz"

ls -lh "$OUT_DIR"
