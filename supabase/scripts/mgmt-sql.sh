#!/usr/bin/env bash
# Run SQL against a hosted Supabase project through the Management API, so no
# direct database connectivity is needed (GitHub runners have no IPv6 route to
# the direct DB host).
#
#   scripts/mgmt-sql.sh <project-ref> <file.sql>
#   scripts/mgmt-sql.sh <project-ref> -c "select count(*) from public.whiskeys"
#
# Needs SUPABASE_ACCESS_TOKEN (a personal access token, sbp_...). Prints the
# JSON result rows.
set -euo pipefail
ref=${1:?project ref}; shift
if [ "${1:-}" = "-c" ]; then sql=${2:?sql}; else sql=$(cat "${1:?sql file}"); fi
# The endpoint runs the statements in its own transaction; drop a file-level begin/commit.
sql=$(printf '%s\n' "$sql" | sed -E '/^[[:space:]]*(begin|commit);[[:space:]]*$/Id')
jq -n --arg q "$sql" '{query: $q}' \
  | curl -sS --fail-with-body -X POST "https://api.supabase.com/v1/projects/${ref}/database/query" \
      -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN not set}" \
      -H "Content-Type: application/json" --data-binary @-
echo
