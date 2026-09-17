#!/usr/bin/env bash
# Apply every migration + seed to a throwaway database on a vanilla Postgres 16
# and run the smoke tests. Needs psql on PATH and a reachable server.
#
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres supabase/scripts/local-check.sh
#
# For a real Supabase stack use `supabase start && supabase db reset` instead.
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${DRAM_CHECK_DB:-dram_check}"
PSQL="psql -v ON_ERROR_STOP=1 -q -X"

$PSQL -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
$PSQL -d "$DB" -f scripts/_supabase_stub.sql
for f in migrations/*.sql; do
  echo "== ${f}"
  $PSQL -d "$DB" -f "$f"
done
for f in seed/*.sql; do
  echo "== ${f}"
  $PSQL -d "$DB" -f "$f"
done
echo "== tests/smoke.sql"
$PSQL -d "$DB" -f tests/smoke.sql
echo "OK: schema, seed and smoke tests passed on ${DB}"
