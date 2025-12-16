#!/bin/bash
set -euo pipefail

label="${SEYMOUR_LAUNCHD_LABEL:-com.seymour}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
home_dir="${HOME:?HOME is not set}"

bun_path="${BUN_PATH:-}"
if [[ -z "${bun_path}" ]]; then
  bun_path="$(command -v bun || true)"
fi
if [[ -z "${bun_path}" ]]; then
  echo "error: bun not found; set BUN_PATH or ensure bun is on PATH" >&2
  exit 1
fi

launch_agents_dir="${home_dir}/Library/LaunchAgents"
plist_path="${launch_agents_dir}/${label}.plist"
stdout_log="${home_dir}/Library/Logs/seymour.log"
stderr_log="${home_dir}/Library/Logs/seymour.error.log"

mkdir -p "${launch_agents_dir}"

cat > "${plist_path}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${bun_path}</string>
    <string>run</string>
    <string>src/server.ts</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${repo_root}</string>

  <key>StandardOutPath</key>
  <string>${stdout_log}</string>
  <key>StandardErrorPath</key>
  <string>${stderr_log}</string>

  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:${home_dir}/.bun/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
EOF

echo "wrote ${plist_path}"
echo "next: edit EnvironmentVariables in the plist if you want PORT/DB_PATH/APP_PASSWORD/etc"
echo "then: bun run service:restart"
