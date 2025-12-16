#!/bin/bash
set -euo pipefail

label="${SEYMOUR_LAUNCHD_LABEL:-com.seymour}"
home_dir="${HOME:?HOME is not set}"

launch_agents_dir="${home_dir}/Library/LaunchAgents"
plist_path="${launch_agents_dir}/${label}.plist"

if [[ -f "${plist_path}" ]]; then
  rm -f "${plist_path}"
  echo "removed ${plist_path}"
else
  echo "not found: ${plist_path}"
fi

echo "next: bun run service:stop (if it was running)"

