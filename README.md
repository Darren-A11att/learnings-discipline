# learnings-discipline

> A Claude Code plugin that turns *"we kept a CLAUDE.md and a LEARNINGS.md and it worked extraordinarily well"* into something every project gets by default.

## Why this exists

Across a two-week working session, one project shipped a working v1.1 Android-launcher mod by leaning hard on a documentation discipline:

- A `.claude/CLAUDE.md` that **forced** consultation of `.claude/LEARNINGS.md` before any task touching documented topics.
- A `.claude/LEARNINGS.md` that catalogued what was tried, what worked, what failed, and the recipes that emerged.
- A `.claude/thoughts/` folder for multi-perspective brainstorms when the path forward was ambiguous.
- A `.claude/plans/` folder for plan-mode artifacts.

The discipline produced measurable propagation — LEARNINGS.md got **87 downstream citations** from subagents and patches, CLAUDE.md got **34**. The discipline beat the plan: when the original plan diverged from reality, agents cited LEARNINGS.md and corrected the plan instead of executing a wrong plan to completion.

This plugin packages that practice into reusable primitives so future projects start with it pre-installed.

## What it ships

| Surface | Slash command | What it does |
|---|---|---|
| Skill | `/learn init [project-type]` | Scaffold `.claude/CLAUDE.md` + `.claude/LEARNINGS.md` from a templated, M1-M9-baked-in starting point |
| Skill | `/learn brainstorm "<topic>"` | Dispatch N (default 5) parallel perspective agents writing `.claude/thoughts/0K-<slug>.md`, then a synthesizer writing `00-PLAN-<slug>.md` |
| Skill | `/learn capture-failure` | Append the latest failed attempt to LEARNINGS.md §"Things that did NOT work" with `(tried, failed because, mitigation)` |
| Skill | `/learn capture-win` | Append the latest working approach with `(approach, why it worked, when to use)` |
| Skill | `/learn audit` | Dispatch the `learnings-auditor` agent to check structural rot, drift, missing privileged sections, stale entries |
| Skill | `/learn recall <topic>` | Surface relevant LEARNINGS.md sections inline via MCP `learnings_relevant_sections` |
| Skill | `/learn retrospective` | Read all artifacts under `.claude/` and synthesize a retrospective |
| Hook | `SessionStart` | Inject LEARNINGS.md heading list (~500 tokens) at session start; suggest `/learn init` if no CLAUDE.md present |
| Hook | `PostToolUse:Bash` | Detect win-after-failure pattern (exit 0 following exit ≠ 0), suggest `/learn capture-win` |
| Hook | `UserPromptSubmit` | Detect ambiguity markers (`ways to`, `approaches`, `brainstorm`, …) and suggest `/learn brainstorm`; detect pivot phrases and suggest `/learn capture-failure` |
| MCP tool | `learnings_read` | Return full LEARNINGS.md + heading index |
| MCP tool | `learnings_relevant_sections` | Keyword + symptom scored search |
| MCP tool | `learnings_append_section` | Validated append (refuses H3 nesting, > 200-word paragraphs) |
| MCP tool | `learnings_capture_failure` | Structured append to "Things that did NOT work" |
| MCP tool | `learnings_capture_win` | Structured append to "What Worked" |
| MCP tool | `learnings_audit` | M1/M5/M7 intact check, privileged-sections present, stale entries, broken cross-refs |
| MCP tool | `thoughts_create` | Create `.claude/thoughts/0N-<slug>.md` with correct prefix numbering |
| MCP tool | `template_get` | Return any template body (CLAUDE.md, LEARNINGS.md, plan, perspective) |
| Agent | `brainstorm-perspective` | One angle of an N-agent brainstorm team |
| Agent | `brainstorm-synthesizer` | Reads all perspectives, writes a unified plan |
| Agent | `learnings-auditor` | Structural audit + drift detection |

## The nine mechanics this enforces (M1–M9)

| | Mechanic | Where it lives |
|---|---|---|
| M1 | MUST language with no escape clauses | Baked into `templates/CLAUDE.md.tmpl` |
| M2 | Semantic-similarity trigger, not just literal match | Baked into `templates/CLAUDE.md.tmpl` |
| M3 | Explicit 35+ keyword trigger list | `template_get` returns project-type-specific keywords |
| M4 | Symptom-match triggers, not just topic-match | Privileged "Common crash patterns" section in `LEARNINGS.md.tmpl` |
| M5 | Cite-don't-rederive obligation | Baked into `templates/CLAUDE.md.tmpl`; audited by `learnings-auditor` |
| M6 | Privileged-sections directive | "Things that did NOT work" + "Common crash patterns" anchor in template; auditor checks presence |
| M7 | Living-document obligation | Baked into template; `learn capture-failure` and `learn capture-win` skills make it easy |
| M8 | Task-shape playbook templates | Per-task-shape sections in CLAUDE.md template |
| M9 | Skimmable document shape | `learnings_append_section` validates flat structure |

See `docs/methodology.md` for the full writeup.

## Install

```sh
# Add the marketplace
/plugin marketplace add Darren-A11att/learnings-discipline-marketplace

# Install
/plugin install learnings-discipline@learnings-discipline-marketplace
```

## Quickstart

In a fresh project:

```
/learn init generic
```

That writes `.claude/CLAUDE.md` and `.claude/LEARNINGS.md` from the generic template. After that, the hooks and MCP tools take over. Every session start, the LEARNINGS heading list is injected (~500 tokens). Every Bash success after a failure suggests `/learn capture-win`. Every "let's try something else" suggests `/learn capture-failure`.

## Dogfooded

This plugin is built using its own discipline. See `.claude/CLAUDE.md`, `.claude/LEARNINGS.md`, and `.claude/thoughts/00-architecture.md` in this repo. The plugin's own institutional memory grows as we ship it.

## Status

v0.1.0 — first publishable version. Scope and roadmap in `.claude/thoughts/00-architecture.md` and `/Users/darrenallatt/.claude/plans/let-s-also-do-robust-graham.md`.

## License

MIT.
