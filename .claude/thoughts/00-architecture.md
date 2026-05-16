# 06 — Plugin packaging plan: the LEARNINGS.md methodology as a Claude Code plugin

## Context

Over a multi-day modding session this project produced a working binary (`v1.1`) by leaning hard on a documented operating discipline: a `.claude/CLAUDE.md` that forces consultation of `.claude/LEARNINGS.md` before any task, and a `.claude/LEARNINGS.md` that catalogs what was tried, what worked, what failed, and the concrete recipes that emerged. The pattern delivered outsized value:

- The "v7a vs arm64" gotcha, the "VMP Pairip is a dead end" gotcha, and the "use `adb pull` not APKPure" pivot were each rediscovered exactly once and then never repeated — every subsequent session that bumped into the symptom found the answer already documented.
- Subagents I dispatched during the ad-research phase cited `LEARNINGS.md §"Manifest scrub regex"` and `LEARNINGS.md §"Smali stubbing recipe"` by section name, evidence the rule propagated from the project CLAUDE.md through the agent tree.
- The "Things that did NOT work and why" section saved roughly a day of recreating dead-end approaches when planning Phase 2's deep ad-research task.
- The auditing pass that the manifest-scrub agent did caught that v1.0's `manifest_scrub.py` silently missed Unity Ads and three self-named ad activities — the agent only noticed because it was checking against the documented LEARNINGS.md §"Manifest scrub regex" list.

This document plans how to package that practice into a reusable Claude Code plugin so future projects start with the same discipline pre-installed instead of recreating it manually.

## 1. The nine mechanics that made it work — verbatim from the artifacts

Each numbered mechanic is quoted from `.claude/CLAUDE.md` or `.claude/LEARNINGS.md` and is mapped to a plugin primitive in §3.

### M1. **MUST language with no escape clauses**

> Before responding to any task in this repo … you **MUST** read `.claude/LEARNINGS.md` and treat the lessons there as authoritative for this codebase.

The word "MUST" + bolding made compliance non-negotiable. No "consider", no "when relevant". The instruction is unconditional within the listed scope.

### M2. **Semantic-similarity trigger, not just literal match**

> You must consult LEARNINGS.md not only when the user's request is literally identical to a section heading, but whenever it is semantically or conceptually similar.

This single line is what generalises a topic-specific journal into a general consultation discipline. The model is asked to do classification, not just substring matching.

### M3. **Explicit trigger keyword list — bigger than you'd think**

> User mentions any keyword close to: smali, apktool, apksigner, zipalign, AAB, xapk, split APK, native lib, .so, loadLibrary, UnsatisfiedLinkError, ABI, arm64, armeabi, ContentProvider auto-init, ad SDK, AdMob, AppLovin, Pangle, Pairip, VMP, integrity check, license check, signature check, manifest scrub, ClassNotFoundException, ANR, FATAL EXCEPTION, install-multiple, INSTALL_FAILED_*, package rename, app label rename, keystore re-sign

35+ keywords. The breadth matters: anything narrower would leak. The list is concrete enough that the model can self-check against it without subjective judgment.

### M4. **Symptom-match triggers, not just topic-match**

> User describes symptoms that match crashes documented there (black screen on launch, "failed to load" dialog, install failure, NPE in random code, missing native lib)

This is the key extension beyond keywords. A user who says "the app keeps failing to load" doesn't use any of the M3 keywords but still triggers the consultation rule. M4 makes the discipline robust to non-technical user phrasing.

### M5. **Cite-don't-rederive obligation**

> Do not silently re-derive a solution that section X already records — cite section X.

This is the citation rule that prevents the model from "discovering" something the doc already knows. The subagents I dispatched during ad-research evidence the rule worked: `patches/notes/A3-findings.md:39` and `:67` cite `LEARNINGS.md §"Manifest scrub regex"` by name.

### M6. **Privileged-sections directive**

> The "Things that did NOT work" and "Common crash patterns" sections are especially valuable — most failure modes have already been hit in this project, and re-hitting them costs hours.

Explicit weighting tells the model which sections to read first when the file is long. "Failure catalog" and "symptom→fix" sections do disproportionate work.

### M7. **Living-document obligation**

> If during a session you discover a new failure mode, a new working pattern, or a refinement of an existing pattern — append a new section to LEARNINGS.md and tell the user. The file is the project's institutional memory; keeping it current is part of every task.

LEARNINGS.md isn't a static deliverable — it must grow during work. The "tell the user" requirement means updates are surfaced, not silent. Without M7 the file decays.

### M8. **Task-shape playbook templates**

CLAUDE.md doesn't just list rules — it provides explicit recipes per task shape:

> ## When the user asks for a new feature or bug fix
> 1. Read LEARNINGS.md (always).
> 2. State which prior learning(s) apply …
> 3. Use the smoke-test loop in LEARNINGS.md §10 …
> 4. Patch, rebuild, sign, install, smoke-test. **Do NOT** propose installing Android Studio …

> ## When the user asks "how did this work?"
> Answer with cited references to LEARNINGS.md sections. Do not paraphrase from memory …

These templates compress decision-making into a script. The "Do NOT propose installing Android Studio" was a real intervention I caught from this rule during the v1.0 debug loop.

### M9. **Document shape that supports skimming**

LEARNINGS.md is 16 H2 sections, ~210 lines, no H3. CLAUDE.md is 52 lines, ~5 sections. The flat structure means M6's "skim every `##` heading first" is fast — the table of contents is the file. No nesting, no preamble, no marketing prose. Every paragraph is either a fact, a recipe, or a quote.

---

The synthesis: nine mechanics, all literally text on disk in two files. Nothing about the model. Nothing about the tooling. The pattern is a documentation discipline first, and the plugin's job is to make that discipline easy to adopt and hard to forget — not to replace it with code.

## 2. What the plugin must provide

Goals, in priority order:

1. **Make scaffolding trivial.** A user types one command and gets the right `.claude/CLAUDE.md` + `.claude/LEARNINGS.md` starting structure with M1–M9 baked in.
2. **Enforce M1 + M2 without manual CLAUDE.md edits.** A project that installs the plugin should get the consultation discipline even if the developer never opens CLAUDE.md. This requires a hook because plugins cannot inject CLAUDE.md fragments into a project context (per the claude-code-guide survey, §"Project-Level vs User-Level vs Plugin-Level CLAUDE.md").
3. **Make LEARNINGS.md updates frictionless.** Tools that the model can call directly to append a new section, query the existing sections, or audit the structure. MCP tools are the right primitive because they're called by name without prompting overhead.
4. **Propagate the discipline to subagents.** When the user dispatches `Agent`, the new context must also see the consultation rule. This requires either (a) a `SessionStart` hook that runs in every subagent too, or (b) explicit "see LEARNINGS.md §X" lines in the subagent prompt template.
5. **Provide an auditor that can be invoked at any time.** An agent that reads LEARNINGS.md and CLAUDE.md and flags structural rot — missing sections, stale entries, unsourced rules — so the file doesn't decay quietly.

Non-goals (for the first version):

- Multi-project sync. Each project's LEARNINGS.md is local; we're not building a knowledge graph across repos.
- AI summarisation of long LEARNINGS.md files. M9's "flat structure" is on the project to maintain.
- A web UI. CLI + Claude Code's native interfaces only.

## 3. Architecture — mapping mechanics to primitives

| Mechanic | Primitive | Why |
|---|---|---|
| M1 (MUST language) | Skill template + Hook injection | The skill provides the canonical CLAUDE.md text; the hook re-asserts it each session |
| M2 (semantic similarity) | Skill template | Bake the rule into the scaffolded CLAUDE.md verbatim |
| M3 (trigger keywords) | MCP `learnings_relevant_sections` tool | When the user message arrives, the hook calls the tool to find topically-matching sections to surface |
| M4 (symptom triggers) | MCP tool + LEARNINGS.md section convention | Same tool; we ship a recommendation that LEARNINGS.md include a "Common crash patterns" section the tool can match symptoms against |
| M5 (cite-don't-rederive) | Skill template + Auditor agent | The text rule scaffolds in CLAUDE.md; an optional `Stop` hook can post-validate that responses citing technical terms include section references |
| M6 (privileged sections) | LEARNINGS.md template | The scaffold has the section names; the user just fills them |
| M7 (living document) | Slash command `/learn add` + MCP tool | One command to append a section; recommendation lives in the scaffolded CLAUDE.md |
| M8 (task-shape templates) | Skill template (per-shape sub-sections in CLAUDE.md) | Boilerplate that the user customises per project |
| M9 (flat document shape) | LEARNINGS.md template + Auditor agent | Template enforces the shape; auditor flags H3 nesting, paragraphs > 200 words, etc. |

### The stack

1. **MCP server** (the long-term primary surface):
   - `learnings_read`: returns full LEARNINGS.md plus an index of H2 headings
   - `learnings_relevant_sections(query)`: keyword + symptom match against the file, returns matching section names + first paragraph
   - `learnings_append_section(heading, body)`: validates the new section is well-formed and appends
   - `learnings_audit`: returns structural-rot warnings (sections > N lines, H3 nesting, missing privileged-section names, stale dates)
   - `claudemd_template_get(project_type)`: returns a starter CLAUDE.md tailored to a project type (android-mod, web-app, data-pipeline, etc.)
   - `learnings_template_get(project_type)`: same for LEARNINGS.md

2. **`SessionStart` hook** (the enforcement surface):
   - Reads `.claude/LEARNINGS.md` if present; emits `additionalContext` containing the file's H2 heading list (not the body — that's what `learnings_read` is for) plus a single reminder line: *"This project has institutional memory at .claude/LEARNINGS.md. Consult it before responding to anything that touches the topics above. See .claude/CLAUDE.md for the rule."*
   - Token-budget-friendly: heading list is typically <500 tokens even for a large LEARNINGS.md

3. **Skills** (the scaffolding surface, manually-invoked):
   - `/learn init [project-type]`: writes `.claude/CLAUDE.md` and `.claude/LEARNINGS.md` from templates. Refuses to overwrite if either exists, unless `--force`.
   - `/learn add <section-title>`: opens an interactive flow where the model + user co-author a new section, then calls `learnings_append_section`
   - `/learn audit`: dispatches the auditor agent

4. **Subagent** (`learnings-auditor`):
   - Reads CLAUDE.md and LEARNINGS.md
   - Verifies M1, M5, M7 language is present and unchanged
   - Verifies LEARNINGS.md has "Things that did NOT work" and "Common crash patterns" (or equivalent) sections
   - Flags sections that haven't been touched in N months as candidates for archival
   - Flags missing cross-references (claims like "see §5" where §5 doesn't exist)
   - Returns a report; can apply non-controversial fixes with permission

5. **Optional `UserPromptSubmit` hook** (the propagation surface):
   - For long sessions where the SessionStart-injected context might compact away: re-inject the heading list when the prompt matches any keyword in CLAUDE.md's trigger-keyword list
   - Off by default (extra token cost); enabled per-project via plugin settings

## 4. Concrete file layout

```
learnings-discipline/                            # the plugin repo root
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── LICENSE
├── skills/
│   ├── learn-init/
│   │   ├── SKILL.md
│   │   └── templates/
│   │       ├── CLAUDE.md.tmpl          # the canonical scaffold with M1–M9 prebaked
│   │       ├── LEARNINGS.md.tmpl       # the canonical 16-section scaffold
│   │       ├── android-mod/            # per-project-type overrides
│   │       │   ├── CLAUDE.md.tmpl
│   │       │   └── LEARNINGS.md.tmpl
│   │       ├── web-app/
│   │       └── data-pipeline/
│   ├── learn-add/SKILL.md
│   └── learn-audit/SKILL.md
├── agents/
│   └── learnings-auditor.md
├── hooks/
│   └── hooks.json                       # SessionStart + optional UserPromptSubmit
├── scripts/
│   ├── session-start.sh                 # reads LEARNINGS.md, emits hookSpecificOutput JSON
│   ├── user-prompt-submit.sh            # optional re-injector
│   └── relevant-sections.sh             # keyword/symptom matcher used by MCP tool
├── mcp/
│   ├── package.json
│   ├── index.js                         # MCP server entry
│   ├── tools/
│   │   ├── learnings_read.js
│   │   ├── learnings_relevant_sections.js
│   │   ├── learnings_append_section.js
│   │   ├── learnings_audit.js
│   │   ├── claudemd_template_get.js
│   │   └── learnings_template_get.js
│   └── lib/
│       ├── parse.js                     # tiny H2-based markdown parser
│       └── match.js                     # keyword + symptom scorer
├── .mcp.json
└── docs/
    ├── methodology.md                   # the full nine-mechanics writeup, lifted from this plan
    ├── adapting-per-project.md          # how to fork the templates
    └── cookbook.md                      # worked examples of LEARNINGS.md sections
```

`plugin.json`:

```json
{
  "name": "learnings-discipline",
  "version": "1.0.0",
  "description": "Enforces the LEARNINGS.md consultation discipline: read before acting, cite don't rederive, append on discovery.",
  "author": { "name": "Darren-A11att" },
  "homepage": "https://github.com/Darren-A11att/learnings-discipline",
  "repository": "https://github.com/Darren-A11att/learnings-discipline",
  "license": "MIT",
  "keywords": ["documentation", "institutional-memory", "claude-code", "methodology"],
  "skills": "./skills/",
  "agents": ["./agents/learnings-auditor.md"],
  "hooks": "./hooks/hooks.json",
  "mcpServers": "./.mcp.json"
}
```

`hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh" }
        ]
      }
    ]
  }
}
```

The `session-start.sh` script (in pseudocode):

```bash
#!/usr/bin/env bash
F="${CLAUDE_PROJECT_DIR}/.claude/LEARNINGS.md"
if [ ! -f "$F" ]; then exit 0; fi

# Extract H2 headings
headings=$(grep -E '^## ' "$F")

# Emit hook output
jq -n --arg headings "$headings" '{
  continue: true,
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ("This project has institutional memory at `.claude/LEARNINGS.md` with these sections:\n\n" + $headings + "\n\nConsult LEARNINGS.md before responding to anything that touches these topics. See `.claude/CLAUDE.md` for the rule. Use the MCP `learnings_relevant_sections` tool to find the right section by keyword or symptom.")
  }
}'
```

Token cost: O(headings) per session start, typically <500 tokens. The model still reads the body on demand via MCP — that's the design.

## 5. The CLAUDE.md template

The scaffold writes a customised version of the project's existing `.claude/CLAUDE.md`, parameterised by:

- `{{PROJECT_NAME}}`
- `{{TRIGGER_KEYWORDS}}` (project-type-specific list)
- `{{SYMPTOM_FINGERPRINTS}}` (project-type-specific list)

Skeleton (Android-mod variant shown — same shape for others):

```markdown
# {{PROJECT_NAME}} — Claude operating instructions

## Required first step: read LEARNINGS.md

Before responding to any task in this repo — {{SCOPE_PARAGRAPH}} — you **MUST** read
`.claude/LEARNINGS.md` and treat the lessons there as authoritative for this codebase.

You must consult LEARNINGS.md not only when the user's request is literally
identical to a section heading, but whenever it is semantically or conceptually
similar. Examples that should trigger a re-read:

- User mentions any keyword close to: {{TRIGGER_KEYWORDS}}
- User describes symptoms that match crashes documented there ({{SYMPTOM_FINGERPRINTS}})
- User asks "how did we do X before" or "what did we learn about Y"

If the user's request is conceptually related but not perfectly aligned,
**re-read LEARNINGS.md anyway** and tell the user which prior learning is
closest before proposing a new approach. Do not silently re-derive a solution
that section X already records — cite section X.

## How to read LEARNINGS.md effectively
It is structured by topic. Skim every `##` heading first. The "Things that
did NOT work" and "Common crash patterns" sections are especially valuable —
most failure modes have already been hit in this project, and re-hitting
them costs hours.

## When the user asks for a new feature or bug fix
1. Read LEARNINGS.md (always).
2. State which prior learning(s) apply and the playbook step you're about to execute.
3. {{DEBUG_LOOP_REFERENCE}}
4. {{TEST_LOOP_REFERENCE}}

## When the user asks "how did this work?"
Answer with cited references to LEARNINGS.md sections. Do not paraphrase from memory.

## When updating LEARNINGS.md
If during a session you discover a new failure mode, a new working pattern, or
a refinement of an existing pattern — append a new section to LEARNINGS.md and
tell the user. The file is the project's institutional memory; keeping it
current is part of every task.
```

The user can then add project-specific sections ("Working in this repo", "Toolchain quick reference" etc.) without breaking the disciplined core.

## 6. The LEARNINGS.md template

```markdown
# LEARNINGS — {{PROJECT_NAME}}

Technical journal. Future readers (humans + LLM sessions): this is the
playbook, the traps, and the reasoning. Read once, save hours.

## Project goal
{{one-paragraph orientation}}

## Methodology that worked
{{the technical framework — the four-layer model, the data pipeline shape, whatever frames the work}}

## Things that did NOT work and why
{{failure catalog — entries with (what was tried, why it failed, mitigation)}}

## Common patterns and their fixes
{{symptom → fix table}}

## Reproducible playbook
{{numbered procedure — N steps from a clean repo to a shipped build}}

## Toolchain setup
{{environment — paths, versions, the no-sudo route on macOS, etc.}}

## Constraints and gotchas
{{anything that bit you and isn't obviously a "failure" — version-specific quirks, architectural assumptions, etc.}}
```

Seven anchor sections covering the privileged ones from M6. The user can add topic-specific sections between them as the project grows.

## 7. The MCP server — minimal viable shape

Node.js, ~300 LOC total. The tool interface:

```typescript
// learnings_relevant_sections — the most-called tool
{
  query: string;             // user message or partial topic
  max_results?: number;      // default 5
}
// returns
{
  matches: Array<{
    heading: string;
    score: number;
    first_paragraph: string;
    line_range: [number, number];
  }>;
  total_sections: number;
}
```

Scoring algorithm:

1. **Exact-match keyword hit** in trigger list (M3) → +10
2. **Symptom phrase match** (case-insensitive substring against M4's documented list) → +8
3. **TF-IDF similarity** between query and section body → +0 to +5
4. **Heading verbatim presence in query** → +6

Top-N returned. Cheap to run, deterministic, no embeddings needed for v1.

```typescript
// learnings_append_section
{
  heading: string;        // must be unique within the file
  body: string;           // markdown; the tool validates no H3+ nesting (M9)
  position?: 'end' | 'after:<existing-heading>';
}
// returns
{
  written: boolean;
  warnings: string[];     // e.g. "section is >200 lines, consider splitting"
}
```

The validator runs M9 checks (flat structure, paragraph length, etc.) and either appends or returns warnings for user review. This is how M7 stays clean — the tool refuses to let LEARNINGS.md decay.

```typescript
// learnings_audit
{}
// returns
{
  m1_intact: boolean;     // "MUST" language present in CLAUDE.md?
  m5_intact: boolean;     // "cite section X" rule present?
  m7_intact: boolean;     // "append a new section" rule present?
  privileged_sections: { name: string, present: boolean }[];
  structural_warnings: string[];
  stale_sections: { name: string, last_modified: string }[];  // via git blame
  broken_cross_references: { from: string, to: string }[];
}
```

The auditor agent is mostly a thin wrapper that calls this tool, summarises, and proposes fixes.

## 8. The user experience

First use, brand new project:

```bash
# install
claude plugin marketplace add Darren-A11att/learnings-discipline-marketplace
claude plugin install learnings-discipline

# in a session in a fresh repo
> /learn init android-mod
# writes .claude/CLAUDE.md and .claude/LEARNINGS.md from the android-mod templates;
# both files open in the editor for the developer to customise scope, project name etc.
```

Day-to-day, the SessionStart hook is invisible — it just injects the heading list. When a topic comes up:

> User: "the install keeps failing with INSTALL_FAILED_NO_MATCHING_ABIS"
> Claude: *calls `learnings_relevant_sections({query: "INSTALL_FAILED_NO_MATCHING_ABIS"})`* → returns §"Architecture matters — the v7a vs arm64 lesson"
> Claude: "Per LEARNINGS.md §'Architecture matters', this is the v7a/arm64 mismatch from earlier. The fix is …"

Appending a new section:

```
> /learn add "Vendor-specific Pairip variants"
```

Triggers the model to draft the section, call `learnings_append_section`, and surface a diff for the user to approve.

Auditing:

```
> /learn audit
```

Dispatches the auditor agent which produces a report and (with permission) applies non-controversial fixes.

## 9. Implementation plan — phases

### Phase 0 — repo scaffold (one evening)

- Create `learnings-discipline` repo
- Write `plugin.json`, README, LICENSE, marketplace.json
- Stub directory structure per §4
- Hello-world `session-start.sh` that emits a static `additionalContext`
- Hello-world MCP server that exposes one tool (`learnings_read`)
- Manual test: install plugin locally, verify SessionStart hook fires and `learnings_read` is callable

### Phase 1 — templates and scaffolding (one evening)

- Write `CLAUDE.md.tmpl` and `LEARNINGS.md.tmpl` (the generic versions)
- Implement `/learn init` skill: copies templates to `.claude/`, prompts for project-type, fills `{{PROJECT_NAME}}`
- Add `android-mod` template variant (lifting the keywords + scope text from this project's actual CLAUDE.md as the gold reference)
- Test by running `/learn init` in a fresh dummy repo and inspecting output

### Phase 2 — MCP tools (two evenings)

- Implement `learnings_relevant_sections` with the §7 scoring algorithm
- Implement `learnings_append_section` with M9 validation
- Implement `learnings_read`, `learnings_audit`
- Wire up `SessionStart` hook to emit heading list dynamically (not static)
- Add unit tests for the markdown parser and the scoring algorithm

### Phase 3 — agents and skills (one evening)

- Implement `learnings-auditor` agent definition; wire it through the MCP `learnings_audit` tool
- Implement `/learn add` (interactive section-adding flow)
- Implement `/learn audit` (dispatches the auditor agent)

### Phase 4 — additional project-type variants (one evening per variant)

- `web-app` variant
- `data-pipeline` variant
- `cli-tool` variant
- Each variant ships its own trigger-keywords, symptom fingerprints, debug-loop reference

### Phase 5 — documentation (one evening)

- `docs/methodology.md` — the nine-mechanics writeup
- `docs/adapting-per-project.md` — guide for customising templates
- `docs/cookbook.md` — three or four worked LEARNINGS.md sections lifted from this project (the v7a/arm64 lesson, the Pairip-VMP dead end, the "pivot that worked", the smali stubbing recipe) as canonical examples

### Phase 6 — marketplace publish (one evening)

- Create `marketplace.json` in a separate `learnings-discipline-marketplace` repo
- Test fresh install via the marketplace path
- Write announcement post

Total: ~9 evenings of focused work.

## 10. Validation criteria — when is this plugin "good"?

The plugin works when:

1. A fresh repo with the plugin installed and `/learn init` run gives the developer a `.claude/CLAUDE.md` and `.claude/LEARNINGS.md` that pass a side-by-side comparison with this project's hand-written versions (i.e. the templates capture M1–M9 verbatim).
2. The SessionStart hook fires invisibly and adds <500 tokens of context per session.
3. The model in a fresh session correctly cites a LEARNINGS.md section when asked about a topic that's in the file — measured by sampling 5 fresh sessions per project type and grading citation behaviour.
4. The `/learn add` flow produces well-formed sections that pass `learnings_audit` without warnings.
5. A real LEARNINGS.md (this project's, or another) processed by `learnings_audit` produces a report that's actionable, not noise.
6. Three real users adopt the plugin and one of them reports a session where the discipline caught a regression that would otherwise have been re-discovered.

## 11. Risks and how each is mitigated

- **Hook injection feels intrusive.** Mitigation: keep additionalContext short (heading list only, with a single sentence pointing to the rule). Don't dump full LEARNINGS.md every session.
- **MCP tools aren't called by the model.** Mitigation: the SessionStart hook explicitly tells the model the tool exists. Tool descriptions are written to surface naturally (e.g. `"Search project's institutional memory for relevant prior learnings"`).
- **Templates rot.** Mitigation: the templates ship with the plugin and are versioned; updates flow through `claude plugin update`. The auditor agent flags templates that drift from the current version.
- **Project types aren't a clean taxonomy.** Mitigation: ship a small set (3–4) and a generic fallback; let users customise after init rather than trying to cover every domain.
- **Citation discipline still relies on the model.** Mitigation: the auditor's `m5_intact` check verifies the rule is in CLAUDE.md, but enforcement is still soft. An optional `Stop` hook that runs a citation-presence check is a v2 feature.
- **The user wants to override the rule mid-session.** Mitigation: CLAUDE.md is plain markdown, the user can edit it. The plugin doesn't lock anything.

## 12. Open questions for follow-up

- Should the plugin support **multiple LEARNINGS files** per repo (e.g. one per subsystem)? Probably not in v1 — the discipline relies on a single point of truth — but big monorepos may need it.
- Should `learnings_append_section` automatically add a date stamp to new sections? Useful for staleness detection but adds noise. Default off, configurable.
- Is there a way to **persist the MCP server's index across sessions** so cold-start is cheap? Probably yes via `~/.claude/plugins/cache/.../index.json`; v2.
- Should the plugin expose a **per-project rule override**? Some teams may want stricter ("MUST cite, no exceptions") or looser ("consult when relevant") wording. Likely a config in `.claude/learnings.toml`, v2.

---

## Summary

The discipline that drove this project to a working v1.1 build is captured in nine concrete mechanics, all expressed as text on disk in two files. A Claude Code plugin that packages those mechanics ships: (a) project-type-aware templates that scaffold both files with M1–M9 prebaked, (b) a `SessionStart` hook that surfaces the LEARNINGS.md headings without flooding the context, (c) an MCP server with five tools (`read`, `relevant_sections`, `append_section`, `audit`, `template_get`) that lets the model consult and update the file directly, (d) three slash skills (`/learn init`, `/learn add`, `/learn audit`) for explicit operations, and (e) an auditor agent that verifies the rules haven't drifted. Implementation budget: ~9 evenings to v1.0; marketplace-installable; minimal token overhead; works alongside existing project conventions instead of replacing them.

The key insight: this isn't a "make Claude smarter" plugin. It's a "make the team's documentation discipline survive long-term" plugin. The model is already capable of following M1–M9 — the friction is in the writing, maintaining, and re-injecting that discipline across many sessions and many subagents. The plugin lowers that friction to one install command and one `/learn init`.
