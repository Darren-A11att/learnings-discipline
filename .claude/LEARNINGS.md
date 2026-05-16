# LEARNINGS — learnings-discipline plugin

Technical journal for building the plugin. Future readers (humans + LLM sessions): this is the playbook, the traps, and the reasoning. Read once, save hours.

## Project goal

Package the documentation discipline that shipped the `Clean iOS 26 v1.1` Android-launcher mod (over at `/Users/darrenallatt/Development/launcher/`) into a Claude Code plugin so future projects start with it pre-installed. The discipline is nine specific mechanics (M1–M9) that turn a CLAUDE.md + LEARNINGS.md pair into a self-enforcing, self-updating institutional memory. The plugin's job is not to replace human judgement — it's to remove the friction of writing, maintaining, and propagating the discipline. v0.1 ships seven slash skills, three subagents, three hooks, eight MCP tools, four project-type template variants, and a marketplace listing.

## The nine mechanics — quick reference

The full design is at `.claude/thoughts/00-architecture.md`. Quick reference:

- **M1**: MUST language with no escape clauses.
- **M2**: Semantic-similarity trigger, not just literal match.
- **M3**: Explicit 35+ keyword trigger list.
- **M4**: Symptom-match triggers, not just topic-match.
- **M5**: Cite-don't-rederive obligation.
- **M6**: Privileged-sections directive.
- **M7**: Living-document obligation.
- **M8**: Task-shape playbook templates.
- **M9**: Skimmable document shape.

Every template, hook, MCP tool, and audit check maps to one or more of these. Cite mechanic IDs in code comments and commit messages.

## The architecture in one paragraph

The plugin layers four primitive types: **templates** (the scaffold), **skills** (slash commands the user invokes), **hooks** (the trigger-detection surface), and an **MCP server** (the durable data surface). Templates capture the verbatim text mechanics (M1, M2, M5, M7, M8). Skills make explicit operations cheap (`/learn init`, `/learn brainstorm`, `/learn capture-*`). Hooks turn implicit conversational signals into nudges (a Bash success after failures → suggest `/learn capture-win`; an ambiguous user prompt → suggest `/learn brainstorm`). The MCP server is the only stateful surface — every read, write, append, audit, search goes through it so the file format stays consistent and the M9 validator (flat structure, paragraph length) runs on every append. Subagents (perspective, synthesizer, auditor) operate in isolated contexts and use the MCP tools as their data plane.

## The dev loop

Every change cycle:

1. Read this file. Identify which mechanic / phase you're working on.
2. Edit code or templates.
3. Run `scripts/verify_plugin.sh` (static checks: plugin.json parses, all paths resolve, skill frontmatter valid, MCP tools have schemas, templates contain literal M1/M5/M7 strings).
4. Install plugin locally: `claude plugin install $(pwd)` from this repo.
5. In a separate Claude Code session in a temp dir, exercise the changed surface.
6. If a new pattern surfaced (a hook fired correctly, a template avoided a gotcha) → append to "What worked" via `/learn capture-win`.
7. If something failed and you pivoted → `/learn capture-failure`.

This loop is itself a worked example of M7 (living-document obligation): the file you're reading grows as the plugin grows.

## Common pitfalls and their fixes

(Will populate during development. Initial known pitfalls from the reference launcher project:)

- **Bash 3.2 vs Bash 4 on macOS.** `mapfile`/`readarray` don't exist in macOS's default bash. Use `while IFS= read -r line; do ... done <<EOF\n$lines\nEOF` instead.
- **BSD `sed -i` vs GNU `sed -i`.** macOS sed requires `sed -i '' ...` with an empty backup-suffix argument. GNU sed rejects this. Detect with `[[ "$OSTYPE" == "darwin"* ]]` if portability is needed.
- **`mkdir`'s side effects.** `mkdir` resets the shell's `cwd` in this environment. Always re-`cd` into the working directory after `mkdir -p` if the next command depends on cwd.
- **JSON with `--` inside.** XML/HTML-style comments can't contain `--`. The launcher project hit this when `manifest_scrub.py` double-wrapped already-commented entries. Detect and unwrap. Same risk applies if any plugin tool emits HTML comments containing user-supplied strings.

## Things that did NOT work and why

- **Lexical-only detection of "this is a design decision" in v0.1.0.** Tried: detect the moment the user makes a request that should trigger a `.claude/thoughts/0N-*.md` design doc by regex-matching ambiguity markers (`ways to`, `approaches`, `tradeoffs`, `brainstorm`, `explore`) in the user prompt. Failed because: real-world architectural requests often don't use ambiguity language — `"implement JWT auth on the API"` is unambiguous but still has multiple design decisions (token storage, refresh strategy, key rotation). The hook stayed silent on those. Mitigation: added a softer Trigger B2 in `user-prompt-submit.sh` for design-decision verbs (`implement|design|architect|build|refactor|migrate|integrate|set up|stand up|wire up|add (a|the|an) (feature|...)`), throttled by "did any thoughts doc get touched in the last hour?". False-positive rate is higher than Trigger B; the suggestion text is softer to compensate.
- **Pure documentation enforcement of "before code is written".** Tried: relying on CLAUDE.md text alone to instruct the model to write a thoughts/ doc before any non-trivial Write/Edit. Failed because: documentation is advisory; the model can (and will) skip straight to code on any task that doesn't trip a hook. Mitigation: added a `PreToolUse:Write|Edit` advisory hook (`pre-tool-use-write.sh`) that emits a non-blocking systemMessage when the model is about to write a non-trivial file with no recent thoughts/ activity. Throttled to once per 30 min to avoid noise. Skips dotfiles, configs, tests, simple docs, and anything under `.claude/`. Still advisory — doesn't block — because hard-blocking writes would be more disruptive than the discipline is worth.

## What worked

(Will populate during development. The first big win was choosing M1–M9 as the spec; everything else flows from those.)

## Template authoring conventions

When writing or modifying a template file (`templates/*.md.tmpl`):

- Placeholders use `{{NAME_IN_SCREAMING_SNAKE}}` so they survive markdown renderers and grep easily.
- Required placeholders: `{{PROJECT_NAME}}`, `{{TRIGGER_KEYWORDS}}`, `{{SYMPTOM_FINGERPRINTS}}`. Optional: `{{DEBUG_LOOP_REFERENCE}}`, `{{TEST_LOOP_REFERENCE}}`, `{{TOOLCHAIN_PATHS}}`.
- The literal text `**MUST**` must appear at least once in any CLAUDE.md template, anchoring M1 for the auditor's grep.
- The phrase `Do not silently re-derive` must appear, anchoring M5.
- The phrase `append a new section` must appear, anchoring M7.
- LEARNINGS.md templates must include the H2 headings `## Things that did NOT work` (or substring match) and one of `## What worked` / `## Common pitfalls`.

The auditor uses these literal substrings; changing them breaks the audit. Coordinate edits with `mcp/lib/audit.js`.

## MCP server conventions

- All tools take a single JSON object input, return a single JSON object output.
- Tool descriptions are written in second person addressed to the model: *"Search the project's institutional memory…"*, not *"Returns search results…"*. The model picks up tools more readily this way.
- No tool blocks. All disk I/O is synchronous (the server is short-lived per session anyway).
- Error responses follow `{error: {code: string, message: string}}` shape, never throwing across the JSON-RPC boundary.
- The `LEARNINGS_PROJECT_DIR` env var is set by `.mcp.json` to `${CLAUDE_PROJECT_DIR}`. All tools resolve paths from there.

## Hook conventions

- Every hook script is `set -euo pipefail`.
- Hooks read JSON from stdin (Claude Code passes context). Use `jq` to parse.
- Hooks emit JSON on stdout. Schema: `{continue: bool, hookSpecificOutput: {hookEventName, additionalContext, systemMessage}}`.
- Hooks must complete in < 2 seconds or they get killed. No network calls.
- Hook state (e.g. last-N exit codes for the win-after-failure detector) goes in `$LEARNINGS_PROJECT_DIR/.claude/.learn-state.json` — gitignored.
- A kill-switch env var disables every hook: `LEARNINGS_DISCIPLINE_HOOKS=off`. Document this so users can disable for one-off sessions.

## Skill conventions

- File format: `skills/<slug>/SKILL.md`.
- Frontmatter: `name`, `description`, `argument-hint` (optional), `allowed-tools` (list), `disable-model-invocation: false`.
- Body: the actual instructions to the model when the skill is invoked. Treat the body as a system prompt for the duration of the skill's execution.
- Skills with side effects (init, capture-*, brainstorm) MUST list the MCP tools they call in `allowed-tools` so the harness gates them.

## Agent conventions

- File format: `agents/<slug>.md`.
- Frontmatter: `name`, `description`, `model: opus` (default for synthesis/audit), `tools` (whitelist), `disallowedTools` (blacklist).
- Body: agent's system prompt + behaviour spec.
- Agents that write files must declare `Write` and `Edit` in `tools`; reading-only agents (auditor without auto-fix) declare only `Read`, `Bash`, `Grep`.

## The credibility check

By v0.1 ship date this file should contain ≥5 entries in "What worked" and ≥5 entries in "Things that did NOT work" derived from actual development experience — not synthetic examples. If at ship time this file is still empty in those sections, the plugin's automation isn't actually firing. That's a blocker, not a warning.

## References

- `/Users/darrenallatt/Development/launcher/.claude/CLAUDE.md` — the gold reference CLAUDE.md the templates derive from.
- `/Users/darrenallatt/Development/launcher/.claude/LEARNINGS.md` — the gold reference LEARNINGS.md (16 sections, ~210 lines, flat structure).
- `/Users/darrenallatt/Development/launcher/.claude/thoughts/06-learnings-plugin-design.md` — the architectural design lifted into this repo's `.claude/thoughts/00-architecture.md`.
- `/Users/darrenallatt/.claude/plans/let-s-also-do-robust-graham.md` — the implementation plan that drove this repo's creation.
