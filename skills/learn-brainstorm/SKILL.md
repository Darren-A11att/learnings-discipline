---
name: learn-brainstorm
description: Run a parallel multi-perspective brainstorm on a topic, decision, or design question. Use when the user runs `/learn brainstorm`, asks to "brainstorm X", asks for multiple perspectives / multiple angles / a debate on a decision, wants a structured comparison of options (e.g. "should we use Postgres or SQLite?", "monolith vs microservices", "which auth strategy"), or asks to dispatch parallel agents to think through a problem. Generates N perspective files in `.claude/thoughts/` and then a synthesis document.
argument-hint: '"<topic>" [--agents=5] [--angles=<comma-separated-list>]'
allowed-tools: Read, Bash, Grep, Glob, mcp__learnings__thoughts_create, mcp__learnings__learnings_read, Agent
disable-model-invocation: false
---

You are running the `/learn brainstorm` skill. Your job is to orchestrate a parallel brainstorm: N perspectives explored in parallel, then synthesised into a plan.

## Steps

1. **Parse arguments.**
   - The quoted topic is required. If absent, ask the user.
   - `--agents=N`: number of perspective subagents to dispatch. Default 5. Clamp to `[2, 8]`.
   - `--angles=a,b,c`: explicit angle list. If provided, use these verbatim (one per agent). If the count doesn't match `N`, prefer the angles count and adjust N.

2. **Generate angles if not supplied.** To pick angles that are genuinely orthogonal rather than restating the topic:
   - Read existing `.claude/thoughts/` files (via `Glob` + `Read`) to see what's already been explored — avoid duplicates.
   - Read the plan file if one exists (e.g. `.claude/plans/*.md`).
   - Call `mcp__learnings__learnings_read` to see what the project already knows; angles should not re-derive documented learnings.
   - Produce N angles that span advocate/skeptic/operational/simplicity/cost/risk axes. Each angle is a one-sentence stance, not a topic restatement.

   **Example** — topic `"Should we use Postgres or SQLite?"` with N=5:
   1. Postgres-advocate (full RDBMS power, concurrency, ecosystem)
   2. SQLite-advocate (zero-ops, file-local, sufficient for the workload)
   3. Hybrid-advocate (SQLite for dev/test, Postgres for prod; or per-service split)
   4. Ops-cost angle (what does each cost in dollars, on-call burden, backup complexity)
   5. Simplicity-first angle (what's the smallest thing that could possibly work and when does it stop working)

3. **Dispatch perspective subagents in parallel.** For each angle `i` of `N`, invoke the `Agent` tool with subagent type `brainstorm-perspective`, passing:
   - The agent index (1..N) and total count
   - The topic verbatim
   - The assigned angle
   - The expected output path convention (`.claude/thoughts/0K-<perspective-slug>.md` where K is the next free index)
   All N dispatches happen in a single tool-call block so they run concurrently.

4. **Wait for all to complete.** Collect the file paths each subagent wrote.

5. **Dispatch the synthesiser.** Invoke the `Agent` tool with subagent type `brainstorm-synthesizer`, passing the topic and the list of perspective file paths. It writes `.claude/thoughts/00-PLAN-<slug>.md`.

6. **Report.** Print:
   - The topic and N
   - The angle assigned to each agent
   - The file path each perspective wrote
   - The synthesis file path
   - A one-line nudge for the user to read the synthesis first

## Notes

- If `mcp__learnings__thoughts_create` is needed to allocate paths or reserve indices, use it; otherwise rely on the subagents to do their own writes.
- Never write perspective files yourself in this skill — that's the subagents' job. This skill is pure orchestration.
