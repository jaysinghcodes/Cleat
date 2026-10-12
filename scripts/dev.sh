#!/usr/bin/env bash
# Start the trainer desk and Expo in this terminal. Expo stays in front so the QR code is usable.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export CLEAT_ROOT="${CLEAT_ROOT:-$ROOT}"

# shellcheck source=lib/common.sh
source "$ROOT/scripts/lib/common.sh"
# shellcheck source=lib/prereqs.sh
source "$ROOT/scripts/lib/prereqs.sh"
# shellcheck source=lib/env.sh
source "$ROOT/scripts/lib/env.sh"
# shellcheck source=lib/ports.sh
source "$ROOT/scripts/lib/ports.sh"
# shellcheck source=lib/processes.sh
source "$ROOT/scripts/lib/processes.sh"

unset CI || true
unset CONTINUOUS_INTEGRATION || true
export EXPO_NO_TELEMETRY=1
export NEXT_TELEMETRY_DISABLED=1

root="$(cleat_repo_root)"
state="$root/.cleat"
web_env="$root/apps/web/.env.local"
mobile_env="$root/apps/mobile/.env"
web_pid=""

cleat_dev_cleanup() {
  trap - EXIT INT TERM
  if [ -n "${web_pid:-}" ]; then
    cleat_kill_tree "$web_pid" || true
    cleat_wait_dead "$web_pid" || true
  fi
  rm -f "$state/web.pid" "$state/dev.pid" "$state/port"
}

if [ ! -f "$web_env" ] || [ ! -f "$mobile_env" ]; then
  echo "Env files are missing."
  echo "Fix: pnpm run setup"
  exit 1
fi

api_url="$(cleat_status_get NEXT_PUBLIC_SUPABASE_URL "$web_env")"
case "$api_url" in
  http://127.0.0.1:* | http://localhost:* | http://0.0.0.0:*)
    if ! cleat_check_docker "$root"; then
      exit 1
    fi
    ;;
esac

mkdir -p "$state"
if [ -f "$state/dev.pid" ]; then
  old="$(tr -d '[:space:]' <"$state/dev.pid")"
  if [ -n "$old" ] && kill -0 "$old" 2>/dev/null; then
    echo "Cleat dev is already running."
    echo "Fix: pnpm stop"
    exit 1
  fi
  rm -f "$state/dev.pid" "$state/web.pid" "$state/port"
fi

port="$(cleat_pick_desk_port)"
cleat_set_mobile_desk_port "$mobile_env" "$port"
printf '%s\n' "$port" >"$state/port"

if [ "${CLEAT_DEV_STUB:-}" = "1" ]; then
  web_cmd=(sleep 300)
  expo_cmd=(sleep 300)
else
  web_cmd=(pnpm --filter @cleat/web exec next dev -H 0.0.0.0 -p "$port")
  expo_cmd=(pnpm exec expo start)
fi

trap cleat_dev_cleanup EXIT INT TERM

"${web_cmd[@]}" >"$state/web.log" 2>&1 &
web_pid=$!
printf '%s\n' "$web_pid" >"$state/web.pid"
printf '%s\n' "$$" >"$state/dev.pid"

if [ "${CLEAT_DEV_STUB:-}" != "1" ]; then
  ready=0
  i=0
  while [ "$i" -lt 60 ]; do
    if cleat_port_in_use "$port"; then
      ready=1
      break
    fi
    if ! kill -0 "$web_pid" 2>/dev/null; then
      break
    fi
    sleep 0.5
    i=$((i + 1))
  done
  if [ "$ready" -ne 1 ]; then
    echo "The desk did not start on port ${port}." >&2
    if [ -f "$state/web.log" ]; then
      tail -n 40 "$state/web.log" >&2 || true
    fi
    exit 1
  fi
fi

desk_url="$(cleat_status_get EXPO_PUBLIC_DESK_URL "$mobile_env")"
cleat_announce_desk_port "$port"
echo "Desk: http://localhost:${port}"
echo "Phone: ${desk_url}"
echo "Desk log: .cleat/web.log"
echo "Scan the QR code with Expo Go on the same Wi-Fi."
echo "Stop with pnpm stop."
echo

if [ "${CLEAT_DEV_STUB:-}" = "1" ]; then
  "${expo_cmd[@]}"
else
  (
    cd "$root/apps/mobile"
    "${expo_cmd[@]}"
  )
fi
