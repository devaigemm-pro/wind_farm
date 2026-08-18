#!/bin/zsh
# PreToolUse hook: checks if a tool invocation is deploy-related
# Reads JSON from stdin, checks tool name and arguments
# Outputs permissionDecision:ask if it's a deploy/push-to-main operation

INPUT=$(cat)

# Try to extract tool name and arguments
TOOL_NAME=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # Try different possible JSON structures
    name = d.get('toolName', '') or d.get('tool', '') or d.get('name', '')
    tool_input = d.get('toolInput', {}) or d.get('input', {}) or {}
    command = tool_input.get('command', '') or tool_input.get('cmd', '')
    skill_name = tool_input.get('name', '')
    print(f'{name}|||{command}|||{skill_name}')
except:
    print('|||')
" 2>/dev/null || echo "|||")

TOOL=$(echo "$TOOL_NAME" | cut -d'|' -f1-3 | cut -d'|' -f1)
CMD=$(echo "$TOOL_NAME" | cut -d'|' -f4-6 | sed 's/^||//')
SKILL=$(echo "$TOOL_NAME" | cut -d'|' -f7- | sed 's/^||//')

# Log for debugging
echo "TOOL=$TOOL CMD=$CMD SKILL=$SKILL" >> /tmp/deploy-gate-debug.log 2>/dev/null

# Check if this is deploy-to-vercel skill activation
if [[ "$SKILL" == "deploy-to-vercel" ]]; then
  echo '{"hookSpecificOutput":{"permissionDecision":"ask","permissionDecisionReason":"⛔ Deploy a producción. ¿Aprobar?"}}'
  exit 0
fi

# Check if command touches production/main
if echo "$CMD" | grep -qE "vercel deploy|vercel.*--prod|git push.*main|git merge.*main|git checkout main"; then
  echo '{"hookSpecificOutput":{"permissionDecision":"ask","permissionDecisionReason":"⛔ Comando afecta producción/main. ¿Aprobar?"}}'
  exit 0
fi

# Not a deploy operation, allow
exit 0
