#!/bin/zsh
# At session end: kill preview processes, commit pending changes, push the session branch.
# Does NOT auto-merge to main — that happens via the release flow or manual merge.

set -e

cd /Users/Apple/Documents/Kiro/wind_farm

CURRENT=$(git branch --show-current 2>/dev/null || echo "")

# Only act if on a session branch
if [[ "$CURRENT" != session/* ]]; then
  echo "Not on a session branch ($CURRENT), skipping."
  exit 0
fi

# --- Kill any vite preview processes started by this session ---
# Find vite preview processes in this project directory and kill them
PREVIEW_PIDS=$(lsof -ti :4173-4199 2>/dev/null | sort -u)
if [[ -n "$PREVIEW_PIDS" ]]; then
  for PID in $PREVIEW_PIDS; do
    # Only kill if it's a node/vite process from this directory
    PROC_CWD=$(lsof -p "$PID" -Fn 2>/dev/null | grep "^n.*wind_farm" | head -1)
    if [[ -n "$PROC_CWD" ]]; then
      kill "$PID" 2>/dev/null || true
      echo "Killed preview process PID=$PID"
    fi
  done
fi

# --- Commit changes (excluding learning profile) ---
if git diff --quiet && git diff --cached --quiet; then
  echo "No changes to commit on $CURRENT"
else
  # Stage all changes EXCEPT learning profile files (those stay local only)
  git add -A
  git reset -- .kiro/agents/user-profile.md 2>/dev/null || true

  # Only commit if there are staged changes after exclusions
  if ! git diff --cached --quiet; then
    git commit -m "session: auto-commit changes from $CURRENT" 2>/dev/null || true
  else
    echo "No non-profile changes to commit on $CURRENT"
  fi
fi

# --- Push with retry (handles race condition if another session pushed to main) ---
MAX_RETRIES=3
RETRY=0
PUSHED=false

while [[ $RETRY -lt $MAX_RETRIES ]] && [[ "$PUSHED" == "false" ]]; do
  if git push -u origin "$CURRENT" 2>/dev/null; then
    PUSHED=true
  else
    RETRY=$((RETRY + 1))
    echo "Push attempt $RETRY failed, retrying..."
    sleep 1
  fi
done

if [[ "$PUSHED" == "true" ]]; then
  echo "Session branch $CURRENT pushed to origin."
else
  echo "Push failed after $MAX_RETRIES attempts (no remote?)"
fi
