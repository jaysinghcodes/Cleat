# Desk port selection. Port 3000 is the default. A busy port gets the next free one.
[ -n "${CLEAT_PORTS_LOADED:-}" ] && return 0
CLEAT_PORTS_LOADED=1

# A completed TCP handshake means something is accepting connections.
# lsof misses some Node listeners (Next's server is one of them).
cleat_tcp_accepts() {
  local port="$1"
  if command -v timeout >/dev/null 2>&1; then
    timeout 0.3 bash -c "echo >/dev/tcp/127.0.0.1/${port}" >/dev/null 2>&1
    return $?
  fi
  (echo >/dev/tcp/127.0.0.1/"${port}") >/dev/null 2>&1
}

cleat_port_in_use() {
  local port="$1"
  if [ -n "${CLEAT_PORT_IN_USE_HOOK:-}" ]; then
    "$CLEAT_PORT_IN_USE_HOOK" "$port"
    return $?
  fi
  if command -v lsof >/dev/null 2>&1; then
    if lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
  elif command -v ss >/dev/null 2>&1; then
    if ss -ltnH "sport = :${port}" 2>/dev/null | grep -q .; then
      return 0
    fi
  fi
  if cleat_tcp_accepts "$port"; then
    return 0
  fi
  return 1
}

cleat_pick_desk_port() {
  if ! cleat_port_in_use 3000; then
    printf '%s\n' "3000"
    return 0
  fi
  local port=3001
  while [ "$port" -le 3099 ]; do
    if ! cleat_port_in_use "$port"; then
      printf '%s\n' "$port"
      return 0
    fi
    port=$((port + 1))
  done
  echo "No free desk port from 3000 through 3099." >&2
  return 1
}

cleat_announce_desk_port() {
  local port="$1"
  if [ "$port" = "3000" ]; then
    return 0
  fi
  echo "Port 3000 is in use. The desk is on port ${port}."
  echo "Sign in redirects allow http://localhost:3000/auth/callback. Free port 3000 when you need email sign in on the desk."
}
