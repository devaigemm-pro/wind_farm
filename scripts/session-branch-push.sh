#!/bin/zsh
# At session end: commit pending changes, push the session branch.
# Does NOT auto-merge to main — that happens via the release flow or manual merge.

set -e

cd /Users/Apple/Documents/Kiro/wind_farm

CURRENT=$(git branch --show-current 2>/dev/null || echo "")

# Only act if on a session branch
if [[ "$CURRENT" != session/* ]]; then
  echo "Not on a session branch ($CURRENT), skipping."
  exit 0
fi

# Check if there are changes to commit
if git diff --quiet && git diff --cached --quiet; then
  echo "No changes to commit on $CURRENT"
else
  git add -A
  # Generate commit message from branch name
  git commit -m "session: auto-commit changes from $CURRENT" --allow-empty 2>/dev/null || true
fi

# Push the branch (create remote if needed)
git push -u origin "$CURRENT" 2>/dev/null || git push origin "$CURRENT" 2>/dev/null || echo "Push failed (no remote?)"

echo "Session branch $CURRENT pushed to origin."
