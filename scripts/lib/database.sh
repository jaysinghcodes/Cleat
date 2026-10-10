# Existing database URL, Supabase URL, and anon key. Setup must not replace these.
[ -n "${CLEAT_DATABASE_LOADED:-}" ] && return 0
CLEAT_DATABASE_LOADED=1

_CLEAT_DATABASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$_CLEAT_DATABASE_DIR/common.sh"

cleat_env_get() {
  local key="$1"
  printf '%s' "${!key-}"
}

cleat_file_value() {
  local key="$1"
  local root
  root="$(cleat_repo_root)"
  local file val
  for file in \
    "$root/apps/web/.env.local" \
    "$root/apps/web/.env" \
    "$root/apps/mobile/.env" \
    "$root/.env"
  do
    val="$(cleat_status_get "$key" "$file")"
    if [ -n "$val" ]; then
      printf '%s' "$val"
      return 0
    fi
  done
  printf '%s' ""
}

# Process environment wins. Otherwise the first env file that already has the key.
cleat_env_or_file() {
  local key="$1"
  local current=""
  current="$(cleat_env_get "$key")"
  if [ -n "$current" ]; then
    printf '%s' "$current"
    return 0
  fi
  cleat_file_value "$key"
}

# True for the loopback API this repo's local Supabase uses.
cleat_supabase_url_is_local() {
  local host
  host="$(cleat_url_host "$1")"
  if [ "$host" = "127.0.0.1" ] || [ "$host" = "localhost" ] || [ "$host" = "0.0.0.0" ]; then
    return 0
  fi
  return 1
}

cleat_configured_database_url() {
  cleat_env_or_file DATABASE_URL
}

cleat_configured_supabase_url() {
  local key val
  for key in SUPABASE_URL NEXT_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_URL; do
    val="$(cleat_env_or_file "$key")"
    if [ -n "$val" ]; then
      printf '%s' "$val"
      return 0
    fi
  done
  printf '%s' ""
}

cleat_configured_anon_key() {
  local key val
  for key in SUPABASE_ANON_KEY NEXT_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_SUPABASE_ANON_KEY; do
    val="$(cleat_env_or_file "$key")"
    if [ -n "$val" ]; then
      printf '%s' "$val"
      return 0
    fi
  done
  printf '%s' ""
}

cleat_prefer() {
  local val
  for val in "$@"; do
    if [ -n "$val" ]; then
      printf '%s' "$val"
      return 0
    fi
  done
  printf '%s' ""
}

# True when the URL is the default local Supabase database (port 54322).
cleat_db_host() {
  local rest="${1#*://}"
  if [[ "$rest" == *"@"* ]]; then
    rest="${rest#*@}"
  fi
  rest="${rest%%/*}"
  rest="${rest%%:*}"
  printf '%s' "$rest"
}

cleat_db_port() {
  local rest="${1#*://}"
  if [[ "$rest" == *"@"* ]]; then
    rest="${rest#*@}"
  fi
  rest="${rest%%/*}"
  if [[ "$rest" == *:* ]]; then
    printf '%s' "${rest##*:}"
    return 0
  fi
  printf '%s' ""
}

cleat_url_needs_local_docker() {
  local url="$1"
  local host port
  host="$(cleat_db_host "$url")"
  port="$(cleat_db_port "$url")"
  if { [ "$host" = "127.0.0.1" ] || [ "$host" = "localhost" ]; } && [ "$port" = "54322" ]; then
    return 0
  fi
  return 1
}

cleat_database_reachable() {
  local db_url="$1"
  psql "$db_url" -v ON_ERROR_STOP=1 -X --pset pager=off -c 'select 1' >/dev/null 2>&1
}

cleat_supabase_url_reachable() {
  local url="${1%/}"
  curl -fsS --max-time 5 "${url}/auth/v1/health" >/dev/null 2>&1
}

cleat_psql() {
  local db_url="$1"
  shift
  psql "$db_url" -v ON_ERROR_STOP=1 -X --pset pager=off "$@"
}

# Apply pending SQL files with psql. The auth stub runs only for plain Postgres.
cleat_migrate_url() {
  local db_url="$1"
  local apply_stub="${2:-0}"
  local root
  root="$(cleat_source_root)"
  local mig_dir="$root/packages/db/supabase/migrations"
  if [ ! -d "$mig_dir" ]; then
    echo "Missing ${mig_dir}." >&2
    return 1
  fi

  echo "Applying pending migrations."
  cleat_psql "$db_url" -c "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key);"

  if [ "$apply_stub" = "1" ]; then
    local stub="$root/packages/db/supabase/tests/plain_postgres_auth_stub.sql"
    if [ ! -f "$stub" ]; then
      echo "Missing ${stub}." >&2
      return 1
    fi
    echo "Applying the plain Postgres auth stub."
    cleat_psql "$db_url" -f "$stub"
  fi

  local file base version applied
  for file in "$mig_dir"/*.sql; do
    [ -f "$file" ] || continue
    base="$(basename "$file")"
    version="${base%.sql}"
    applied="$(cleat_psql "$db_url" -tAc "select version from supabase_migrations.schema_migrations where version = '${version}'" | tr -d '[:space:]')"
    if [ "$applied" = "$version" ]; then
      continue
    fi
    echo "Applying ${base}."
    cleat_psql "$db_url" -f "$file"
    cleat_psql "$db_url" -c "insert into supabase_migrations.schema_migrations (version) values ('${version}');"
  done
}
