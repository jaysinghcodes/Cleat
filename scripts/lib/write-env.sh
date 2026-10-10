#!/usr/bin/env bash
# Write the app env files from a `supabase status -o env` capture.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export CLEAT_ROOT="${CLEAT_ROOT:-$(cd "$HERE/../.." && pwd)}"
# shellcheck source=env.sh
source "$HERE/env.sh"

if [ "$#" -ne 1 ] || [ -z "${1:-}" ]; then
  echo "Usage: write-env.sh <status-env-file>" >&2
  exit 1
fi

cleat_write_env "$1"
