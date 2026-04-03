#!/bin/bash
set -e

install_if_missing() {
    local name=$1
    local check_cmd=$2
    local install_cmd=$3

    if command -v "$check_cmd" &>/dev/null; then
        echo "[$name] already installed, skipping"
    else
        echo "[$name] installing..."
        eval "$install_cmd"
        echo "[$name] done"
    fi
}

install_if_missing "claude" "claude" \
    "curl -fsSL https://claude.ai/install.sh | bash"

install_if_missing "copilot" "gh copilot" \
    "curl -fsSL https://gh.io/copilot-install | bash"

install_if_missing "opencode" "opencode" \
    "curl -fsSL https://opencode.ai/install | bash"

echo "AI tools ready"
