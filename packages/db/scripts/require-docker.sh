#!/bin/sh
# Local Supabase and pnpm seed need a running Docker daemon.
if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Open Docker Desktop, wait until it says running, then try again." >&2
  exit 1
fi
