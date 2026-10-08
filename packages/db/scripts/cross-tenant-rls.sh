#!/usr/bin/env bash
# Applies migrations in order and proves a trainer cannot read another org
# and a client cannot read another client's rows, including chat.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_NAME="${CLEAT_RLS_DB:-cleat_rls_test}"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "Docker is available. This script still applies the SQL files with psql so the same assertions run outside the Supabase API."
else
  echo "Docker is not available. Applying migrations to plain Postgres with the auth schema stubbed (tests/plain_postgres_auth_stub.sql)."
  echo "auth.uid() reads request.jwt.claim.sub, which is the same claim Supabase Auth puts on the JWT."
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required." >&2
  exit 1
fi

PSQL=(psql -v ON_ERROR_STOP=1 -X --pset pager=off)
if [[ "$(id -un)" != "postgres" ]]; then
  if command -v sudo >/dev/null 2>&1; then
    PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1 -X --pset pager=off)
  fi
fi

"${PSQL[@]}" -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '${DB_NAME}' and pid <> pg_backend_pid();" >/dev/null
"${PSQL[@]}" -d postgres -c "drop database if exists ${DB_NAME};"
"${PSQL[@]}" -d postgres -c "create database ${DB_NAME};"

echo "Applying auth stub and migrations to ${DB_NAME}."
"${PSQL[@]}" -d "$DB_NAME" -f supabase/tests/plain_postgres_auth_stub.sql
for migration in supabase/migrations/*.sql; do
  echo "Applying ${migration}."
  "${PSQL[@]}" -d "$DB_NAME" -f "$migration"
done

echo "Running cross tenant assertions."
"${PSQL[@]}" -d "$DB_NAME" -f supabase/tests/cross_tenant_rls.sql
echo "Running chat assertions."
"${PSQL[@]}" -d "$DB_NAME" -f supabase/tests/chat_rls.sql
