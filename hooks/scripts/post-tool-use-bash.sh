#!/usr/bin/env bash
# PostToolUse (Bash) hook: Trigger D — detect a successful command after recent failures
# and suggest /learn capture-win. Throttled to one suggestion per 30 minutes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib.sh
. "$SCRIPT_DIR/_lib.sh"

kill_switch_check

INPUT=$(read_stdin_jq_or_empty)

# Extract the bash exit code. Claude Code's PostToolUse payload typically has
# tool_response.exit_code or tool_response.interrupted; we look at common shapes.
EXIT_CODE=$(printf '%s' "$INPUT" | jq -r '
  (.tool_response.exit_code // .tool_response.exitCode //
   .toolResponse.exit_code // .toolResponse.exitCode //
   .result.exit_code // .exit_code // empty) | tostring
' 2>/dev/null || true)

# If we cannot determine exit code, do nothing.
if [ -z "$EXIT_CODE" ] || [ "$EXIT_CODE" = "null" ]; then
  printf '{"continue": true}\n'
  exit 0
fi

NOW=$(now_iso)
NOW_EPOCH=$(date -u +%s)
TEN_MIN_AGO=$((NOW_EPOCH - 600))
THIRTY_MIN_AGO=$((NOW_EPOCH - 1800))

STATE=$(read_or_init_state)

# Update state: trim entries older than 10 minutes, then append current entry.
NEW_STATE=$(printf '%s' "$STATE" | jq \
  --argjson exit_code "$EXIT_CODE" \
  --arg now "$NOW" \
  --argjson cutoff "$TEN_MIN_AGO" '
  .recent_exits = ((.recent_exits // []) | map(select(
    (.timestamp | fromdateiso8601? // 0) >= $cutoff
  )))
  | .recent_exits += [{exit_code: $exit_code, timestamp: $now}]
')

# Check trigger conditions.
HAD_FAILURE=$(printf '%s' "$NEW_STATE" | jq -r '
  [.recent_exits[] | select(.exit_code != 0)] | length > 0
')

LAST_SUGGEST=$(printf '%s' "$NEW_STATE" | jq -r '.last_suggestion_at // ""')

SUGGEST_OK=1
if [ -n "$LAST_SUGGEST" ] && [ "$LAST_SUGGEST" != "null" ]; then
  # Parse the suggestion timestamp; if newer than 30min ago, throttle.
  LAST_EPOCH=$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$LAST_SUGGEST" +%s 2>/dev/null || echo 0)
  if [ "$LAST_EPOCH" -gt "$THIRTY_MIN_AGO" ]; then
    SUGGEST_OK=0
  fi
fi

EMIT_SUGGESTION=0
if [ "$EXIT_CODE" = "0" ] && [ "$HAD_FAILURE" = "true" ] && [ "$SUGGEST_OK" = "1" ]; then
  EMIT_SUGGESTION=1
  NEW_STATE=$(printf '%s' "$NEW_STATE" | jq --arg now "$NOW" '.last_suggestion_at = $now')
fi

printf '%s' "$NEW_STATE" | write_state

if [ "$EMIT_SUGGESTION" = "1" ]; then
  MSG="💡 That command succeeded after some failures. If this represents a working pattern worth keeping, run /learn capture-win to record it in LEARNINGS.md."
  jq -n --arg msg "$MSG" '{
    continue: true,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      systemMessage: $msg
    }
  }'
else
  printf '{"continue": true}\n'
fi
