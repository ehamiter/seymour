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

echo "[evanflow] installing skills..."
claude plugin marketplace add evanklem/evanflow 2>/dev/null || \
  claude plugin marketplace update evanflow
claude plugin install evanflow@evanflow 2>/dev/null || true
echo "[evanflow] done"

echo "AI tools ready"
