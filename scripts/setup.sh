#!/usr/bin/env bash
# From a fresh clone: check the toolchain, install, start Supabase, write env, migrate, seed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export CLEAT_ROOT="${CLEAT_ROOT:-$ROOT}"

# shellcheck source=lib/common.sh
source "$ROOT/scripts/lib/common.sh"
# shellcheck source=lib/prereqs.sh
source "$ROOT/scripts/lib/prereqs.sh"
# shellcheck source=lib/env.sh
source "$ROOT/scripts/lib/env.sh"

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

cleat_seed() {
  local status_file="$1"
  local db_url=""
  db_url="$(cleat_status_get DB_URL "$status_file")"
  echo "Seeding the demo."
  if [ -n "$db_url" ]; then
    DATABASE_URL="$db_url" pnpm seed
  else
    pnpm seed
  fi
}

main() {
  local root
  root="$(cleat_repo_root)"
  cd "$root"

  echo "Checking the local toolchain."
  if ! cleat_check_prereqs "$root"; then
    echo "Setup stopped. Run the fix commands above, then run pnpm run setup again."
    exit 1
  fi

  echo "Installing dependencies."
  pnpm install

  cleat_supabase_up "$root/packages/db"

  local status_file=""
  status_file="$(mktemp)"
  (cd "$root/packages/db" && supabase status -o env) >"$status_file"
  cleat_write_env "$status_file"
  cleat_seed "$status_file"
  rm -f "$status_file"

  echo "Setup finished. Next: pnpm dev. Stop: pnpm stop."
}

main "$@"
