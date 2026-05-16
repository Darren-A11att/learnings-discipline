#!/usr/bin/env bash
# verify_plugin.sh — static checks for the learnings-discipline plugin.
# Validates: plugin.json parses, all referenced paths exist, every skill has
# valid frontmatter, every agent has a model declared, every MCP tool exists,
# every CLAUDE.md template has the M1/M5/M7 anchors, every LEARNINGS.md
# template has the privileged-section headings.
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)

pass=0
fail=0

check() {
    local label=$1
    local condition=$2
    if eval "$condition" >/dev/null 2>&1; then
        printf "  \033[32mPASS\033[0m  %s\n" "$label"
        pass=$((pass + 1))
    else
        printf "  \033[31mFAIL\033[0m  %s\n" "$label"
        fail=$((fail + 1))
    fi
}

echo "==== verify_plugin.sh on $ROOT ===="

# Manifest
check "plugin.json parses"                  'jq -e . .claude-plugin/plugin.json'
check ".mcp.json parses"                    'jq -e . .mcp.json'
check "hooks.json parses"                   'jq -e . hooks/hooks.json'

# Templates: anchor strings
for f in templates/CLAUDE.md.tmpl templates/project-types/*/CLAUDE.md.tmpl; do
    check "M1 anchor in $f"                 "grep -q '\*\*MUST\*\*' $f"
    check "M5 anchor in $f"                 "grep -q 'Do not silently re-derive' $f"
    check "M7 anchor in $f"                 "grep -q 'append a new section' $f"
done

for f in templates/LEARNINGS.md.tmpl templates/project-types/*/LEARNINGS.md.tmpl; do
    check "privileged 'Things that did NOT' in $f" "grep -q 'Things that did NOT' $f"
done

# Skills: every directory has SKILL.md with frontmatter
for d in skills/*/; do
    f=$d/SKILL.md
    check "skill $d has SKILL.md"           "test -f $f"
    check "skill $d frontmatter starts ---" "head -1 $f | grep -q '^---'"
    check "skill $d declares name"          "head -10 $f | grep -q '^name:'"
done

# Agents
for f in agents/*.md; do
    check "agent $f frontmatter starts ---" "head -1 $f | grep -q '^---'"
    check "agent $f declares model"         "head -20 $f | grep -q '^model:'"
done

# MCP server: all 8 tool files exist
for tool in learnings_read learnings_relevant_sections learnings_append_section \
            learnings_capture_failure learnings_capture_win learnings_audit \
            thoughts_create template_get; do
    check "MCP tool $tool.js exists"        "test -f mcp/tools/$tool.js"
    check "MCP tool $tool.js parses"        "node --check mcp/tools/$tool.js"
done
check "MCP index.js parses"                 'node --check mcp/index.js'
check "MCP lib/parse.js parses"             'node --check mcp/lib/parse.js'
check "MCP lib/match.js parses"             'node --check mcp/lib/match.js'
check "MCP lib/audit.js parses"             'node --check mcp/lib/audit.js'

# Hook scripts
for f in hooks/scripts/*.sh; do
    check "$f shell-parses"                 "bash -n $f"
    check "$f executable"                   "test -x $f"
done

# Plugin's own .claude is dogfooded
check ".claude/CLAUDE.md exists"            'test -f .claude/CLAUDE.md'
check ".claude/CLAUDE.md has M1 anchor"     "grep -q '\*\*MUST\*\*' .claude/CLAUDE.md"
check ".claude/CLAUDE.md has M5 anchor"     "grep -q 'Do not silently re-derive' .claude/CLAUDE.md"
check ".claude/CLAUDE.md has M7 anchor"     "grep -q 'append a new section' .claude/CLAUDE.md"
check ".claude/LEARNINGS.md exists"         'test -f .claude/LEARNINGS.md'
check ".claude/LEARNINGS.md has 'NOT work'" "grep -q 'Things that did NOT' .claude/LEARNINGS.md"
check ".claude/thoughts/00-architecture.md exists" 'test -f .claude/thoughts/00-architecture.md'

echo
echo "==== summary: $pass PASS, $fail FAIL ===="
if [ $fail -gt 0 ]; then exit 1; fi
exit 0
