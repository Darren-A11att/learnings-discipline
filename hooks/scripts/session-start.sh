#!/usr/bin/env bash
# SessionStart hook: surface .claude/LEARNINGS.md headings + the consultation rule.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib.sh
. "$SCRIPT_DIR/_lib.sh"

kill_switch_check

# Drain stdin (Claude Code passes session metadata; we don't currently need it).
_=$(read_stdin_jq_or_empty)

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
LEARNINGS="$PROJECT_DIR/.claude/LEARNINGS.md"
CLAUDEMD="$PROJECT_DIR/.claude/CLAUDE.md"

# If LEARNINGS.md is absent, nothing to surface — exit cleanly.
if [ ! -f "$LEARNINGS" ]; then
  printf '{"continue": true}\n'
  exit 0
fi

# Extract H2 headings (lines starting with "## ").
HEADINGS=$(grep -nE '^## ' "$LEARNINGS" || true)

if [ -z "$HEADINGS" ]; then
  # File exists but has no H2 sections; still emit a softer note.
  MSG="This project has a .claude/LEARNINGS.md but it has no H2 sections yet. Consider running /learn init or /learn capture-win to begin populating institutional memory."
  jq -n --arg msg "$MSG" '{
    continue: true,
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $msg
    }
  }'
  exit 0
fi

if [ -f "$CLAUDEMD" ]; then
  CONTEXT="This project has institutional memory at .claude/LEARNINGS.md with these sections:

$HEADINGS

Consult LEARNINGS.md before responding to anything that touches these topics. Use the MCP \`learnings_relevant_sections\` tool to find the right section by keyword or symptom. See .claude/CLAUDE.md for the discipline rules."
else
  CONTEXT="This project has no .claude/CLAUDE.md. Run /learn init to set up institutional memory and the consult-before-acting discipline.

A LEARNINGS.md exists with these sections:

$HEADINGS"
fi

jq -n --arg ctx "$CONTEXT" '{
  continue: true,
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $ctx
  }
}'
