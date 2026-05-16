---
name: learn-capture-win
description: Record a working approach in LEARNINGS.md so it can be cited and reused. Use when the user runs `/learn capture-win`, says something like "this worked", "got it working", "that fixed it", "capture this win", "let's record this pattern", or when the assistant notices a non-trivial working approach was just discovered and worth preserving. Appends an `(approach, why it worked, when to use)` entry to LEARNINGS.md §"What Worked".
argument-hint: '["one-line summary of what worked"]'
allowed-tools: Read, mcp__learnings__learnings_capture_win
disable-model-invocation: false
---

You are running the `/learn capture-win` skill. Your job is to append a well-formed win entry to `.claude/LEARNINGS.md`.

## Steps

1. **Gather the three required fields.**
   - `approach`: a one-line description of what was done. If the user passed a quoted summary, use it verbatim. Otherwise infer from recent conversation context (the patch applied, the command run, the configuration that fixed it).
   - `why_it_worked`: a one-line causal explanation. Why is this the right answer for the symptom? Pull from the diagnosis the assistant or user articulated.
   - `when_to_use`: a one-line predicate describing the situations where future-you should reach for this. Make it symptom-shaped so a later session can pattern-match.

2. **Disambiguate if needed.** If any field can't be confidently inferred, ask the user ONE consolidated clarifying question covering the missing fields. Do not write until you have all three.

3. **Read existing LEARNINGS.md** (optional) to check for near-duplicates. If one exists, mention it and confirm with the user before proceeding.

4. **Call the MCP tool.** Invoke `mcp__learnings__learnings_capture_win` with `{approach, why_it_worked, when_to_use}`. The tool handles formatting and appends to LEARNINGS.md §"What Worked" (or the project's equivalent section).

5. **Confirm.** Report back:
   - The exact line that was added (as returned by the tool)
   - The section it landed in
   - The line number or anchor if the tool returns one

## Style

One line per field, present tense, concrete and symptom-shaped. The `when_to_use` field is the most important — it's what makes the entry findable later. Bad: "use when doing auth". Good: "use when an OAuth provider returns `invalid_grant` on refresh and the client is a SPA".
