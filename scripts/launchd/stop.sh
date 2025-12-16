#!/bin/bash
set -euo pipefail

label="${SEYMOUR_LAUNCHD_LABEL:-com.seymour}"
home_dir="${HOME:?HOME is not set}"
uid="$(id -u)"

plist_path="${home_dir}/Library/LaunchAgents/${label}.plist"
if [[ ! -f "${plist_path}" ]]; then
  echo "error: missing ${plist_path}" >&2
  exit 1
fi

if ! launchctl bootout "gui/${uid}" "${plist_path}" >/dev/null 2>&1; then
  launchctl unload "${plist_path}" >/dev/null 2>&1 || true
fi

echo "stopped ${label}"
