# Stop the desk and Expo process trees started by scripts/dev.sh.
[ -n "${CLEAT_PROCESSES_LOADED:-}" ] && return 0
CLEAT_PROCESSES_LOADED=1

cleat_pid_args() {
  ps -p "$1" -o args= 2>/dev/null || true
}

cleat_safe_to_stop() {
  local args
  args="$(cleat_pid_args "$1")"
  case "$args" in
    *scripts/dev.sh*) return 0 ;;
    *"next dev"*) return 0 ;;
    *"expo start"*) return 0 ;;
  esac
  return 1
}

cleat_kill_tree() {
  local pid="${1:-}"
  local child=""
  local children=""
  if [ -z "$pid" ] || [ "$pid" = "1" ] || [ "$pid" = "$$" ]; then
    return 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  children="$(pgrep -P "$pid" 2>/dev/null || true)"
  for child in $children; do
    cleat_kill_tree "$child"
  done
  kill -TERM "$pid" 2>/dev/null || true
}

cleat_wait_dead() {
  local pid="${1:-}"
  local i=0
  local child=""
  local children=""
  if [ -z "$pid" ]; then
    return 0
  fi
  while [ "$i" -lt 20 ]; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.1
    i=$((i + 1))
  done
  kill -KILL "$pid" 2>/dev/null || true
  children="$(pgrep -P "$pid" 2>/dev/null || true)"
  for child in $children; do
    kill -KILL "$child" 2>/dev/null || true
  done
}
