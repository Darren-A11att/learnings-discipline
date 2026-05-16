#!/usr/bin/env bash
# UserPromptSubmit hook: Triggers B (ambiguity → /learn brainstorm) and C (pivot →
# /learn capture-failure), plus optional keyword re-injection from CLAUDE.md.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib.sh
. "$SCRIPT_DIR/_lib.sh"

kill_switch_check

INPUT=$(read_stdin_jq_or_empty)

# Extract the user prompt text. Claude Code commonly passes it as .prompt or .user_prompt.
PROMPT=$(printf '%s' "$INPUT" | jq -r '
  .prompt // .user_prompt // .userPrompt // .message // .content // empty
' 2>/dev/null || true)

if [ -z "$PROMPT" ] || [ "$PROMPT" = "null" ]; then
  printf '{"continue": true}\n'
  exit 0
fi

emit_context() {
  local msg="$1"
  jq -n --arg ctx "$msg" '{
    continue: true,
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: $ctx
    }
  }'
  exit 0
}

# --- Trigger B: ambiguity markers (strong signal — open-ended exploration) ---
AMBIG_RE='\b(ways to|approaches|options|tradeoffs|brainstorm|explore|how could we|several ways|different ways)\b'
if printf '%s' "$PROMPT" | grep -iqE "$AMBIG_RE"; then
  emit_context "This prompt sounds open-ended. Consider running /learn brainstorm \"<topic>\" to dispatch a multi-perspective agent team into .claude/thoughts/ before settling on an approach."
fi

# --- Trigger B2: design-decision verbs (softer signal — implies architectural choices) ---
# Catches requests like "implement JWT auth", "design the schema", "build the pipeline"
# where the user didn't use ambiguity language but architectural decisions are in play.
# Throttled: only fire if no thoughts/ doc has been created in the current session.
DESIGN_RE='\b(implement|design|architect|build|introduce|refactor|migrate|integrate|set up|stand up|wire up|add (a|the|an) (feature|ability|capability|support|service|endpoint|module|system))\b'
if printf '%s' "$PROMPT" | grep -iqE "$DESIGN_RE"; then
  # Check if any thoughts/ doc was created recently (within this session window).
  THOUGHTS_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/thoughts"
  RECENT_THOUGHTS=0
  if [ -d "$THOUGHTS_DIR" ]; then
    # Count thoughts docs modified in the last 60 minutes.
    if command -v find >/dev/null 2>&1; then
      RECENT_THOUGHTS=$(find "$THOUGHTS_DIR" -maxdepth 1 -name '*.md' -mmin -60 2>/dev/null | wc -l | tr -d ' ')
    fi
  fi
  # Only nudge if no recent thoughts doc exists — assume the user already has one if they do.
  if [ "$RECENT_THOUGHTS" = "0" ]; then
    emit_context "This prompt implies a design decision. If you haven't already, consider running /learn brainstorm \"<topic>\" or creating a .claude/thoughts/0N-<slug>.md design doc BEFORE writing code. The architectural rule from .claude/CLAUDE.md: every design decision goes into thoughts/ before code is written for it."
  fi
fi

# --- Trigger C: pivot markers in last assistant message -----------------------
STATE=$(read_or_init_state)
LAST_ASSIST=$(printf '%s' "$STATE" | jq -r '.last_assistant_message // ""')
PIVOT_RE="\\b(that didn't work|let me try|let's pivot|abandoning|going to try a different|stepping back|different approach)\\b"
if [ -n "$LAST_ASSIST" ] && [ "$LAST_ASSIST" != "null" ]; then
  if printf '%s' "$LAST_ASSIST" | grep -iqE "$PIVOT_RE"; then
    emit_context "It looks like the previous step pivoted away from a failing approach. Consider running /learn capture-failure to record what didn't work and why before moving on."
  fi
fi

# --- Soft keyword reminder from CLAUDE.md ------------------------------------
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
CLAUDEMD="$PROJECT_DIR/.claude/CLAUDE.md"
if [ -f "$CLAUDEMD" ]; then
  # Look for the literal line "User mentions any keyword close to:" and read its remainder.
  KW_LINE=$(grep -i 'User mentions any keyword close to:' "$CLAUDEMD" | head -1 || true)
  if [ -n "$KW_LINE" ]; then
    # Strip everything up to and including the colon.
    KEYWORDS=$(printf '%s' "$KW_LINE" | sed -E 's/.*[Uu]ser mentions any keyword close to:[[:space:]]*//')
    # Tokenise on commas; strip whitespace; ignore short tokens.
    MATCHED=0
    OLDIFS="$IFS"
    IFS=','
    for kw in $KEYWORDS; do
      kw_trim=$(printf '%s' "$kw" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
      # Strip surrounding punctuation/markdown.
      kw_trim=$(printf '%s' "$kw_trim" | sed -E 's/[`*_]//g')
      # Require length >= 3 to avoid matching tokens like ".so" producing FPs.
      if [ "${#kw_trim}" -ge 3 ]; then
        if printf '%s' "$PROMPT" | grep -iqF "$kw_trim"; then
          MATCHED=1
          break
        fi
      fi
    done
    IFS="$OLDIFS"
    if [ "$MATCHED" = "1" ]; then
      emit_context "This prompt touches a topic that LEARNINGS.md documents. Call learnings_relevant_sections to surface the matching section."
    fi
  fi
fi

printf '{"continue": true}\n'
