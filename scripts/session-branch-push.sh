#!/bin/zsh
# At session end: commit pending changes LOCALLY. Does NOT push.
# The push only happens when the user approves merge to main.
# This prevents Vercel from auto-deploying session branches.

set -e

cd /Users/Apple/Documents/Kiro/wind_farm

CURRENT=$(git branch --show-current 2>/dev/null || echo "")

# Only act if on a session branch
if [[ "$CURRENT" != session/* ]]; then
  echo "Not on a session branch ($CURRENT), skipping."
  exit 0
fi

# --- Kill any vite preview processes started by this session ---
PREVIEW_PIDS=$(lsof -ti :4173-4199 2>/dev/null | sort -u)
if [[ -n "$PREVIEW_PIDS" ]]; then
  for PID in $PREVIEW_PIDS; do
    PROC_CWD=$(lsof -p "$PID" -Fn 2>/dev/null | grep "^n.*wind_farm" | head -1)
    if [[ -n "$PROC_CWD" ]]; then
      kill "$PID" 2>/dev/null || true
      echo "Killed preview process PID=$PID"
    fi
  done
fi

# --- Commit changes locally (excluding learning profile) ---
if git diff --quiet && git diff --cached --quiet; then
  echo "No changes to commit on $CURRENT"
else
  git add -A
  git reset -- .kiro/agents/user-profile.md 2>/dev/null || true

  if ! git diff --cached --quiet; then
    git commit -m "session: auto-commit changes from $CURRENT" 2>/dev/null || true
  else
    echo "No non-profile changes to commit on $CURRENT"
  fi
fi

# NO PUSH — push only happens when user approves merge to main.
# This prevents Vercel GitHub integration from auto-deploying session branches.
echo "Changes committed locally on $CURRENT. Push will happen on merge approval."
