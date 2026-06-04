#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Fetch latest remote changes, rebase local work, then push.
git fetch origin
if git rev-parse --verify --quiet HEAD >/dev/null; then
  git pull --rebase origin main
else
  git pull --rebase origin main
fi
git push origin main
