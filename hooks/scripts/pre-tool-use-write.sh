#!/usr/bin/env bash
# PreToolUse:Write advisory hook.
#
# Trigger: the model is about to call Write (or Edit) on a non-trivial file
# AND no .claude/thoughts/0N-*.md doc has been touched in the current session.
# Behaviour: emits a non-blocking systemMessage suggesting a brainstorm/design
# doc first. Never blocks the write — this is advice, not policy.
#
# Skipped path patterns (no nudge):
#   - dotfiles (.gitignore, .env*, .editorconfig, etc.)
#   - small config files (package.json, tsconfig.json, *.lock, *.toml)
#   - simple docs (README.md, CHANGELOG.md, LICENSE)
#   - files inside .claude/ itself (the discipline-meta files)
#   - test files (*.test.*, *_test.*, *spec*)
#   - any path the project marks as exempt (LEARNINGS-exempt list in CLAUDE.md, future)
#
# Kill-switch: LEARNINGS_DISCIPLINE_HOOKS=off disables.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib.sh
. "$SCRIPT_DIR/_lib.sh"

kill_switch_check

INPUT=$(read_stdin_jq_or_empty)

# Extract the target file path from the Write/Edit tool input.
# Claude Code passes the tool name + tool_input shape; for Write/Edit the key is file_path.
TARGET=$(printf '%s' "$INPUT" | jq -r '
  .tool_input.file_path // .toolInput.file_path // .params.file_path // empty
' 2>/dev/null || true)

if [ -z "$TARGET" ] || [ "$TARGET" = "null" ]; then
  printf '{"continue": true}\n'
  exit 0
fi

# Resolve to basename + relative path for matching.
BASENAME=$(basename "$TARGET")
RELPATH="${TARGET#${CLAUDE_PROJECT_DIR:-/}/}"

is_trivial() {
  local p=$1
  local b=$2
  # Dotfiles at root, configs, simple docs, .claude internals, tests.
  case "$b" in
    .*) return 0 ;;
    README.md|CHANGELOG.md|CONTRIBUTING.md|LICENSE|LICENSE.*) return 0 ;;
    package.json|package-lock.json|tsconfig.json|pyproject.toml|Cargo.toml|Cargo.lock|go.mod|go.sum) return 0 ;;
    *.lock|*.toml|*.yaml|*.yml|*.ini|*.cfg) return 0 ;;
    *.test.*|*_test.*|*Test.*|*.spec.*|*_spec.*) return 0 ;;
  esac
  case "$p" in
    *.claude/*) return 0 ;;
    .claude/*) return 0 ;;
    *test/*|*tests/*|*__tests__/*) return 0 ;;
    *node_modules/*|*.venv/*|*venv/*) return 0 ;;
  esac
  return 1
}

if is_trivial "$RELPATH" "$BASENAME"; then
  printf '{"continue": true}\n'
  exit 0
fi

# Check whether any .claude/thoughts/*.md doc has been modified recently.
THOUGHTS_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/thoughts"
RECENT_THOUGHTS=0
if [ -d "$THOUGHTS_DIR" ]; then
  RECENT_THOUGHTS=$(find "$THOUGHTS_DIR" -maxdepth 1 -name '*.md' -mmin -120 2>/dev/null | wc -l | tr -d ' ')
fi

# Throttle: don't fire more than once per 30 minutes (PreToolUse:Write fires
# very often, would be noisy).
STATE=$(read_or_init_state)
LAST_WRITE_NUDGE=$(printf '%s' "$STATE" | jq -r '.last_write_nudge // ""')
THROTTLE_OK=1
if [ -n "$LAST_WRITE_NUDGE" ] && [ "$LAST_WRITE_NUDGE" != "null" ]; then
  if command -v date >/dev/null 2>&1; then
    NOW_EPOCH=$(date -u +%s)
    LAST_EPOCH=$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$LAST_WRITE_NUDGE" +%s 2>/dev/null || echo "0")
    if [ "$LAST_EPOCH" != "0" ]; then
      AGE=$((NOW_EPOCH - LAST_EPOCH))
      if [ "$AGE" -lt 1800 ]; then
        THROTTLE_OK=0
      fi
    fi
  fi
fi

if [ "$RECENT_THOUGHTS" = "0" ] && [ "$THROTTLE_OK" = "1" ]; then
  # Update the throttle timestamp.
  write_state "$(printf '%s' "$STATE" | jq --arg now "$(now_iso)" '.last_write_nudge = $now')"
  jq -n --arg path "$RELPATH" '{
    continue: true,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      systemMessage: ("💡 About to write `" + $path + "` without a design doc in .claude/thoughts/ this session. If this involves architectural decisions, consider /learn brainstorm \"<topic>\" first. This nudge is throttled to once per 30 min; not blocking.")
    }
  }'
  exit 0
fi

printf '{"continue": true}\n'
