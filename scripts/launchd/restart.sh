#!/bin/bash
set -euo pipefail

label="${SEYMOUR_LAUNCHD_LABEL:-com.seymour}"
home_dir="${HOME:?HOME is not set}"
uid="$(id -u)"

plist_path="${home_dir}/Library/LaunchAgents/${label}.plist"
if [[ ! -f "${plist_path}" ]]; then
  echo "error: missing ${plist_path}; run: bun run service:install" >&2
  exit 1
fi

launchctl bootout "gui/${uid}" "${plist_path}" >/dev/null 2>&1 || true
if launchctl bootstrap "gui/${uid}" "${plist_path}" >/dev/null 2>&1; then
  launchctl enable "gui/${uid}/${label}" >/dev/null 2>&1 || true
  launchctl kickstart -k "gui/${uid}/${label}" >/dev/null 2>&1 || true
else
  launchctl unload "${plist_path}" >/dev/null 2>&1 || true
  launchctl load "${plist_path}"
fi

echo "restarted ${label}"
