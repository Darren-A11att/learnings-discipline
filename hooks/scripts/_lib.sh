#!/usr/bin/env bash
# Common helpers for learnings-discipline hook scripts.
# Source this file; do not execute directly.

# Honour the kill switch. If LEARNINGS_DISCIPLINE_HOOKS=off, exit silently with continue:true.
kill_switch_check() {
  if [ "${LEARNINGS_DISCIPLINE_HOOKS:-on}" = "off" ]; then
    printf '{"continue": true}\n'
    exit 0
  fi
}

# Read all of stdin into a variable. If stdin is empty or not JSON, return "{}".
read_stdin_jq_or_empty() {
  local input
  input=$(cat 2>/dev/null || true)
  if [ -z "$input" ]; then
    printf '%s' '{}'
    return 0
  fi
  # Validate JSON; fall back to empty object on parse failure.
  if printf '%s' "$input" | jq -e . >/dev/null 2>&1; then
    printf '%s' "$input"
  else
    printf '%s' '{}'
  fi
}

# Path to the per-project state file.
_state_path() {
  printf '%s/.claude/.learn-state.json' "${CLAUDE_PROJECT_DIR:-.}"
}

# Read state file, or initialise an empty one.
read_or_init_state() {
  local f
  f=$(_state_path)
  if [ -f "$f" ]; then
    if jq -e . "$f" >/dev/null 2>&1; then
      cat "$f"
      return 0
    fi
  fi
  printf '%s' '{"recent_exits": [], "last_suggestion_at": null, "last_assistant_message": null}'
}

# Write JSON state (passed on stdin) to the state file. Creates .claude/ if needed.
write_state() {
  local f dir
  f=$(_state_path)
  dir=$(dirname "$f")
  mkdir -p "$dir" 2>/dev/null || true
  cat > "$f"
}

# ISO8601 timestamp in UTC.
now_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}
