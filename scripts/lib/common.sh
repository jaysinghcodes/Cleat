# Shared helpers for setup, dev, and stop.
[ -n "${CLEAT_COMMON_LOADED:-}" ] && return 0
CLEAT_COMMON_LOADED=1

cleat_source_root() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # common.sh lives in scripts/lib. Walk up to the repo that contains these scripts.
  (cd "$here/../.." && pwd)
}

cleat_repo_root() {
  if [ -n "${CLEAT_ROOT:-}" ]; then
    (cd "$CLEAT_ROOT" && pwd)
    return
  fi
  cleat_source_root
}

cleat_unquote() {
  local val="$1"
  val="${val%$'\r'}"
  val="${val#"${val%%[![:space:]]*}"}"
  val="${val%"${val##*[![:space:]]}"}"
  local n="${#val}"
  if [ "$n" -ge 2 ]; then
    local first="${val:0:1}"
    local last="${val: -1}"
    if { [ "$first" = '"' ] && [ "$last" = '"' ]; } || { [ "$first" = "'" ] && [ "$last" = "'" ]; }; then
      val="${val:1:n-2}"
    fi
  fi
  printf '%s' "$val"
}

# Read KEY from a supabase status env file or a dotenv file.
# Accepts KEY=value, KEY="value", and export KEY=value.
cleat_status_get() {
  local key="$1"
  local file="$2"
  local line=""
  if [ ! -f "$file" ]; then
    printf '%s' ""
    return 0
  fi
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" | tail -n 1 || true)"
  if [ -z "$line" ]; then
    printf '%s' ""
    return 0
  fi
  cleat_unquote "${line#*=}"
}

cleat_dotenv_quote() {
  local val="$1"
  val="${val//\\/\\\\}"
  val="${val//\"/\\\"}"
  printf '"%s"' "$val"
}

cleat_url_host() {
  local url="$1"
  printf '%s' "$url" | sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://([^/:]+).*#\1#'
}

cleat_url_with_host() {
  local url="$1"
  local host="$2"
  printf '%s' "$url" | sed -E "s#^([a-zA-Z][a-zA-Z0-9+.-]*://)[^/:]+#\\1${host}#"
}

# Rewrite a loopback host to the LAN address. Leave any other host alone.
cleat_url_for_lan() {
  local url="$1"
  local lan="$2"
  local host
  host="$(cleat_url_host "$url")"
  if [ "$host" = "127.0.0.1" ] || [ "$host" = "localhost" ]; then
    cleat_url_with_host "$url" "$lan"
    return 0
  fi
  printf '%s' "$url"
}

cleat_url_set_port() {
  local url="$1"
  local port="$2"
  if printf '%s' "$url" | grep -Eq '^[a-zA-Z][a-zA-Z0-9+.-]*://[^/:]+:[0-9]+'; then
    printf '%s' "$url" | sed -E "s#^([a-zA-Z][a-zA-Z0-9+.-]*://[^/:]+):[0-9]+#\\1:${port}#"
    return 0
  fi
  printf '%s' "$url" | sed -E "s#^([a-zA-Z][a-zA-Z0-9+.-]*://[^/:]+)(/|$)#\\1:${port}\\2#"
}
