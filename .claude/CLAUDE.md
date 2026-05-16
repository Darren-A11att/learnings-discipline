# learnings-discipline — Claude operating instructions

## Required first step: read LEARNINGS.md

Before responding to any task in this repo — building MCP tools, writing skill SKILL.md files, designing hooks, debugging plugin install or marketplace flow, working with templates, dealing with JSON schemas for tool I/O, anything plugin-related — you **MUST** read `.claude/LEARNINGS.md` and treat the lessons there as authoritative for this codebase.

You must consult LEARNINGS.md not only when the user's request is literally identical to a section heading, but whenever it is semantically or conceptually similar. Examples that should trigger a re-read:

- User mentions any keyword close to: skill, slash command, hook, SessionStart, PostToolUse, UserPromptSubmit, Stop, MCP, MCP server, tool schema, JSON Schema, plugin.json, marketplace.json, `.claude-plugin`, additionalContext, hookSpecificOutput, agent definition, frontmatter, template, M1, M2, M3, M4, M5, M6, M7, M8, M9, mechanic, trigger, citation, propagation, audit, drift, dogfood
- User describes symptoms that match issues documented there (hook didn't fire, MCP tool not visible to the model, skill not invoked, plugin not listed, marketplace install failure, template variable not substituted, parser broke on H3 nesting, scorer false-positive, audit returned WARN when it should be PASS)
- User asks about modding any other Claude Code plugin, or about authoring documentation-discipline tools for any project
- User asks "how did we do X before" or "what did we learn about Y"

If the user's request is conceptually related but not perfectly aligned, **re-read LEARNINGS.md anyway** and tell the user which prior learning is closest before proposing a new approach. Do not silently re-derive a solution that section X already records — cite section X.

## How to read LEARNINGS.md effectively

It is structured by topic. Skim every `##` heading first. Then read the sections most relevant to the current task. The "Things that did NOT work and why" and "Common pitfalls and their fixes" sections are especially valuable — most failure modes have already been hit in this project, and re-hitting them costs hours.

## Working in this repo

- The plugin is at `/Users/darrenallatt/Development/learnings-discipline/`.
- The reference project is at `/Users/darrenallatt/Development/launcher/` — its `.claude/CLAUDE.md` and `.claude/LEARNINGS.md` are the gold templates. The Android-mod project-type variant lifts from there verbatim.
- Skills are at `skills/<name>/SKILL.md` with YAML frontmatter.
- Agents are at `agents/<name>.md` with YAML frontmatter declaring `model`, `description`.
- Hooks are at `hooks/hooks.json` with shell scripts under `hooks/scripts/`.
- MCP server lives at `mcp/`. Run `node mcp/index.js` to start locally for testing.
- Templates live at `templates/`. Project-type variants under `templates/project-types/<name>/`.
- Do not commit `.claude/.learn-state.json` (it tracks hook state per project).

## When the user asks for a new feature or bug fix

1. Read LEARNINGS.md (always).
2. State which prior learning(s) apply and the playbook step you're about to execute.
3. Use the verify-plugin loop in LEARNINGS.md §"The dev loop" — `scripts/verify_plugin.sh` is the source of truth for whether the plugin is structurally sound.
4. Patch, run the static checks, install locally, run the smoke test, capture the result.

## When the user asks "how did this work?"

Answer with cited references to LEARNINGS.md sections. Do not paraphrase from memory if the file is authoritative. The architectural design at `.claude/thoughts/00-architecture.md` is also authoritative — cite section numbers (M1–M9, §4.x, etc.) when referring to it.

## When updating LEARNINGS.md

If during a session you discover a new failure mode, a new working pattern, or a refinement of an existing pattern — append a new section to LEARNINGS.md and tell the user. The file is the project's institutional memory; keeping it current is part of every task. Use the `/learn capture-failure` or `/learn capture-win` slash command when it applies; otherwise use the MCP `learnings_append_section` tool directly with M9-valid content.

## Dogfooding obligations

This plugin is the canonical example of its own discipline. The following must be true at all times:

- `.claude/CLAUDE.md` (this file) passes `learnings_audit` for M1, M5, M7 intact.
- `.claude/LEARNINGS.md` has the two privileged sections ("Things that did NOT work" and one of "What worked" / "Common pitfalls and their fixes").
- Every design decision goes into `.claude/thoughts/0N-<slug>.md` before code is written for it.
- Every shipped phase adds at least one entry to LEARNINGS.md (a captured win, a captured failure, or a recipe).

If those invariants drift, the plugin is no longer credible as the carrier of the discipline.

## Toolchain quick reference

- Node.js ≥ 20 for the MCP server. Install via `nvm install 20`.
- `npm` for MCP dependencies. The MCP server is stdlib-only by design (no node_modules dependency on `@modelcontextprotocol/sdk` in v0.1 — we hand-write the JSON-RPC framing because it's tiny).
- `jq` for hook scripts that emit JSON.
- `bash` ≥ 3.2 (macOS default) — no `mapfile`, no `readarray`. Use `while IFS= read -r ...` instead.
- The reference launcher repo: `/Users/darrenallatt/Development/launcher/` — its CLAUDE.md, LEARNINGS.md, and patches/notes/*.md are the gold reference for what artifacts produced by the plugin should look like.
