#!/usr/bin/env bash
# From a fresh clone: check the toolchain, install, migrate, and seed.
# An existing database URL is kept and used when that database answers.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export CLEAT_ROOT="${CLEAT_ROOT:-$ROOT}"

# shellcheck source=lib/common.sh
source "$ROOT/scripts/lib/common.sh"
# shellcheck source=lib/prereqs.sh
source "$ROOT/scripts/lib/prereqs.sh"
# shellcheck source=lib/env.sh
source "$ROOT/scripts/lib/env.sh"
# shellcheck source=lib/database.sh
source "$ROOT/scripts/lib/database.sh"

CLEAT_SIGNIN_LINE="Sign in needs Supabase, local or hosted. For a local stack, unset DATABASE_URL and run pnpm run setup with Docker and the Supabase CLI. For a hosted project, create one at https://supabase.com and set its URL and anon key."

cleat_supabase_up() {
  local db_dir="$1"
  if [ ! -d "$db_dir" ]; then
    echo "Missing ${db_dir}." >&2
    return 1
  fi
  echo "Starting Supabase."
  if (cd "$db_dir" && supabase start); then
    :
  elif (cd "$db_dir" && supabase status >/dev/null 2>&1); then
    echo "Supabase is already running."
  else
    return 1
  fi
  echo "Applying pending migrations."
  (cd "$db_dir" && supabase migration up --local)
}

# Seed with a database URL that was already set. Status DB_URL is only a fallback.
cleat_seed() {
  local fallback_url="${1:-}"
  local db_url=""
  db_url="$(cleat_configured_database_url)"
  if [ -z "$db_url" ]; then
    db_url="$fallback_url"
  fi
  echo "Seeding the demo."
  if [ -n "$db_url" ]; then
    DATABASE_URL="$db_url" pnpm seed
  else
    pnpm seed
  fi
}

cleat_setup_stopped() {
  echo "Setup stopped. Run the fix commands above, then run pnpm run setup again."
  exit 1
}

main() {
  local root
  root="$(cleat_repo_root)"
  cd "$root"

  local db_url=""
  local supabase_url=""
  local anon=""
  db_url="$(cleat_configured_database_url)"
  supabase_url="$(cleat_configured_supabase_url)"
  anon="$(cleat_configured_anon_key)"

  if [ -n "$supabase_url" ] && [ -z "$anon" ]; then
    echo "The Supabase URL is set but the anon key is missing."
    echo "Fix: set SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY, then run pnpm run setup again."
    exit 1
  fi
  # A loopback URL is the local stack this script writes. Any other URL without a
  # database URL must stop, so setup does not replace it with local Supabase.
  if [ -n "$supabase_url" ] && [ -z "$db_url" ] && ! cleat_supabase_url_is_local "$supabase_url"; then
    echo "The Supabase URL is set but DATABASE_URL is missing."
    echo "Fix: set DATABASE_URL, then run pnpm run setup again."
    exit 1
  fi

  local mode="local"
  if [ -n "$db_url" ]; then
    if command -v psql >/dev/null 2>&1 && cleat_database_reachable "$db_url"; then
      mode="existing"
    elif cleat_url_needs_local_docker "$db_url"; then
      mode="local"
    elif ! command -v psql >/dev/null 2>&1; then
      echo "psql is required to migrate an existing database."
      echo "Fix: install the Postgres client, then run pnpm run setup again."
      exit 1
    else
      echo "DATABASE_URL is set but the database is not reachable."
      echo "Fix: start that database, then run pnpm run setup again."
      exit 1
    fi
  fi

  echo "Checking the local toolchain."
  if [ "$mode" = "existing" ]; then
    if ! cleat_check_prereqs "$root" skip-stack; then
      cleat_setup_stopped
    fi
  elif ! cleat_check_prereqs "$root"; then
    cleat_setup_stopped
  fi

  if [ "$mode" = "existing" ] && [ -n "$supabase_url" ]; then
    if ! command -v curl >/dev/null 2>&1; then
      echo "curl is required to check the Supabase URL."
      echo "Fix: install curl, then run pnpm run setup again."
      exit 1
    fi
    if ! cleat_supabase_url_reachable "$supabase_url"; then
      echo "The Supabase URL is set but it is not reachable."
      echo "Fix: start that project, then run pnpm run setup again."
      exit 1
    fi
  fi

  echo "Installing dependencies."
  pnpm install

  if [ "$mode" = "existing" ]; then
    local stub=0
    if [ -z "$supabase_url" ]; then
      stub=1
    fi
    cleat_migrate_url "$db_url" "$stub"
    cleat_write_configured_env
    cleat_seed "$db_url"
    echo "Using the existing database. Docker and the Supabase CLI are not required."
    if [ -z "$supabase_url" ]; then
      echo "$CLEAT_SIGNIN_LINE"
    fi
  else
    cleat_supabase_up "$root/packages/db"
    local status_file=""
    status_file="$(mktemp)"
    (cd "$root/packages/db" && supabase status -o env) >"$status_file"
    cleat_write_env "$status_file"
    local status_url=""
    status_url="$(cleat_status_get DB_URL "$status_file")"
    cleat_seed "$status_url"
    rm -f "$status_file"
  fi

  echo "Setup finished. Next: pnpm dev. Stop: pnpm stop."
}

main "$@"
