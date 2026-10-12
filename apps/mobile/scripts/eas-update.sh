#!/usr/bin/env bash
# Publish an EAS Update for Android, then iOS. Web is left out of the export.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

npx eas-cli update --platform android "$@"
npx eas-cli update --platform ios "$@"
