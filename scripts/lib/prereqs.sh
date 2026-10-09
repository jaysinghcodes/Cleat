# Toolchain checks. Each failure prints a command the developer can run.
[ -n "${CLEAT_PREREQS_LOADED:-}" ] && return 0
CLEAT_PREREQS_LOADED=1

_CLEAT_PREREQS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$_CLEAT_PREREQS_DIR/common.sh"

# The sentence lives in packages/db/src/local-docker.ts (PR #31). Read it from there.
cleat_docker_not_running_message() {
  local root="$1"
  local ts="$root/packages/db/src/local-docker.ts"
  local message=""
  if [ ! -f "$ts" ]; then
    echo "Missing ${ts}." >&2
    return 1
  fi
  message="$(
    awk '
      $0 ~ /LOCAL_DOCKER_MESSAGE/ { found = 1; next }
      found && $0 ~ /"/ {
        sub(/^[[:space:]]*"/, "")
        sub(/";[[:space:]]*$/, "")
        print
        exit
      }
    ' "$ts"
  )"
  if [ -z "$message" ]; then
    echo "Could not read LOCAL_DOCKER_MESSAGE from packages/db/src/local-docker.ts." >&2
    return 1
  fi
  printf '%s\n' "$message"
}

cleat_check_clt() {
  if [ "$(uname -s)" != "Darwin" ]; then
    echo "Command Line Tools: skipped on this OS."
    return 0
  fi

  local path_ok=0
  local brew_bad=0
  if xcode-select -p >/dev/null 2>&1; then
    path_ok=1
  fi
  if command -v brew >/dev/null 2>&1; then
    local doctor=""
    doctor="$(brew doctor 2>&1 || true)"
    if printf '%s\n' "$doctor" | grep -Eiq 'command line tools.*(outdated|too old|not installed|missing)|newer command line tools'; then
      brew_bad=1
    fi
  fi

  if [ "$path_ok" -eq 1 ] && [ "$brew_bad" -eq 0 ]; then
    echo "Command Line Tools: ok"
    return 0
  fi

  echo "Command Line Tools are missing or outdated."
  if [ "$brew_bad" -eq 1 ]; then
    echo "Fix: sudo rm -rf /Library/Developer/CommandLineTools && sudo xcode-select --install"
  else
    echo "Fix: xcode-select --install"
  fi
  echo "Then verify with: xcode-select -p"
  return 1
}

cleat_check_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js 22 or newer is required. Node.js is not installed."
    echo "Fix: brew install node@22"
    return 1
  fi
  local major=""
  major="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || true)"
  if ! [[ "$major" =~ ^[0-9]+$ ]] || [ "$major" -lt 22 ]; then
    echo "Node.js 22 or newer is required. This machine has $(node -v 2>/dev/null || echo unknown)."
    if [ -n "${NVM_DIR:-}" ] && [ -s "${NVM_DIR}/nvm.sh" ]; then
      echo "Fix: nvm install && nvm use"
    else
      echo "Fix: brew install node@22"
    fi
    return 1
  fi
  echo "Node.js: ok ($(node -v))"
}

cleat_check_pnpm() {
  local root="$1"
  local want="10.33.3"
  if command -v node >/dev/null 2>&1 && [ -f "$root/package.json" ]; then
    local parsed=""
    parsed="$(node -p "require(process.argv[1]).packageManager.replace(/^pnpm@/, '')" "$root/package.json" 2>/dev/null || true)"
    if [ -n "$parsed" ] && [ "$parsed" != "undefined" ]; then
      want="$parsed"
    fi
  fi

  if ! command -v corepack >/dev/null 2>&1; then
    echo "pnpm ${want} is installed with Corepack, which ships with Node.js 22. Corepack is not available."
    echo "Fix: brew install node@22 && corepack enable && corepack prepare pnpm@${want} --activate"
    return 1
  fi

  local have=""
  if command -v pnpm >/dev/null 2>&1; then
    have="$(pnpm --version 2>/dev/null | tail -n 1 | tr -d '[:space:]' || true)"
  fi
  if [ "$have" = "$want" ]; then
    echo "pnpm: ok (${want} via Corepack)"
    return 0
  fi
  if [ -z "$have" ]; then
    echo "pnpm ${want} is required. pnpm is not installed."
  else
    echo "pnpm ${want} is required. This machine has ${have}."
  fi
  echo "Fix: corepack enable && corepack prepare pnpm@${want} --activate"
  return 1
}

cleat_check_docker() {
  local root="${1:-}"
  if [ -z "$root" ] || [ ! -f "$root/packages/db/src/local-docker.ts" ]; then
    root="$(cleat_source_root)"
  fi
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not installed."
    echo "Fix: brew install --cask docker && open -a Docker"
    echo "Then verify with: docker info"
    return 1
  fi
  if ! docker info >/dev/null 2>&1; then
    cleat_docker_not_running_message "$root"
    echo "Fix: open -a Docker"
    echo "Then verify with: docker info"
    return 1
  fi
  echo "Docker: ok"
}

cleat_check_supabase() {
  if command -v supabase >/dev/null 2>&1; then
    echo "Supabase CLI: ok"
    return 0
  fi
  echo "Supabase CLI is not installed."
  echo "Fix: brew install supabase/tap/supabase"
  return 1
}

cleat_check_prereqs() {
  local root="$1"
  local failed=0
  cleat_check_clt || failed=1
  cleat_check_node || failed=1
  cleat_check_pnpm "$root" || failed=1
  cleat_check_docker "$root" || failed=1
  cleat_check_supabase || failed=1
  return "$failed"
}
