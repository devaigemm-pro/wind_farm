#!/bin/zsh
# Creates or switches to a session-specific branch at session start.
# Receives JSON on stdin with session_id.
# Branch naming: session/<short-id>-<timestamp>
# If already on a session branch, reuses it.

set -e

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id','unknown'))" 2>/dev/null || echo "unknown")

# Extract short session id (last 8 chars)
SHORT_ID="${SESSION_ID: -8}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BRANCH_NAME="session/${SHORT_ID}-${TIMESTAMP}"

cd /Users/Apple/Documents/Kiro/wind_farm

# Check current branch
CURRENT=$(git branch --show-current 2>/dev/null || echo "")

# If already on a session/* branch, reuse it (same session continuing)
if [[ "$CURRENT" == session/* ]]; then
  echo "Already on session branch: $CURRENT"
  exit 0
fi

# Ensure we're on main and up to date
if [[ "$CURRENT" != "main" ]]; then
  git checkout main 2>/dev/null || true
fi

# Pull latest (ignore errors if no remote)
git pull --rebase origin main 2>/dev/null || true

# Create and switch to session branch
git checkout -b "$BRANCH_NAME" 2>/dev/null

echo "Created session branch: $BRANCH_NAME"
