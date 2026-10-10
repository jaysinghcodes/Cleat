#!/usr/bin/env bash
# Stop the desk and Expo started by scripts/dev.sh. Safe to run when nothing is up.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export CLEAT_ROOT="${CLEAT_ROOT:-$ROOT}"

# shellcheck source=lib/common.sh
source "$ROOT/scripts/lib/common.sh"
# shellcheck source=lib/processes.sh
source "$ROOT/scripts/lib/processes.sh"

root="$(cleat_repo_root)"
state="$root/.cleat"

cleat_read_pid() {
  local file="$1"
  if [ ! -f "$file" ]; then
    printf '%s' ""
    return 0
  fi
  tr -d '[:space:]' <"$file"
}

dev_pid="$(cleat_read_pid "$state/dev.pid")"
web_pid="$(cleat_read_pid "$state/web.pid")"
running=0

if [ -n "$dev_pid" ] && kill -0 "$dev_pid" 2>/dev/null && cleat_safe_to_stop "$dev_pid"; then
  running=1
fi
if [ -n "$web_pid" ] && kill -0 "$web_pid" 2>/dev/null && cleat_safe_to_stop "$web_pid"; then
  running=1
fi

if [ "$running" -eq 0 ]; then
  rm -f "$state/dev.pid" "$state/web.pid" "$state/port"
  echo "Cleat dev is not running."
  exit 0
fi

if [ -n "$dev_pid" ] && cleat_safe_to_stop "$dev_pid"; then
  cleat_kill_tree "$dev_pid"
  cleat_wait_dead "$dev_pid"
fi
if [ -n "$web_pid" ] && kill -0 "$web_pid" 2>/dev/null && cleat_safe_to_stop "$web_pid"; then
  cleat_kill_tree "$web_pid"
  cleat_wait_dead "$web_pid"
fi

rm -f "$state/dev.pid" "$state/web.pid" "$state/port"
echo "Stopped the Cleat desk and Expo."
