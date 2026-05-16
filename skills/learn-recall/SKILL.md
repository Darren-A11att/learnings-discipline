---
name: learn-recall
description: Look up sections of `.claude/LEARNINGS.md` relevant to a topic or keyword and surface them inline. Use when the user runs `/learn recall`, asks "what do we know about X?", "have we hit this before?", "does LEARNINGS.md say anything about Y?", "search the learnings", or when the assistant wants to manually trigger a consultation mid-turn before answering a technical question. Returns matching section headings, first paragraphs, and line ranges.
argument-hint: "<topic or keyword>"
allowed-tools: mcp__learnings__learnings_relevant_sections, mcp__learnings__learnings_read
disable-model-invocation: false
---

You are running the `/learn recall` skill. Your job is to find LEARNINGS.md sections relevant to a topic and surface them to the user with a recommendation.

## Steps

1. **Take the topic argument.** It may be a phrase, a keyword, or a symptom description. If empty, ask the user for one.

2. **Query the matcher.** Call `mcp__learnings__learnings_relevant_sections` with `{query: <topic>, max_results: 5}`. The tool returns matches ranked by relevance, each with: heading, first paragraph, line range, and a relevance score.

3. **Handle zero results.** If the matcher returns nothing, say so plainly and suggest the user check whether the project's trigger-keyword list in CLAUDE.md covers this topic. Do not fabricate matches.

4. **Display the matches.** For each match, render:
   - The H2 heading
   - The first paragraph verbatim
   - The line range (e.g. `.claude/LEARNINGS.md:42-58`)
   - The relevance score if available

5. **Recommend the most relevant section** with a one-sentence justification explaining why it's the best match for the user's topic. If the top two are close in relevance, mention both.

6. **Offer to read more.** End with a one-line offer: "Reply with the section name and I'll read it in full" (which would call `mcp__learnings__learnings_read` to fetch the full section body).

## Notes

This skill is read-only. Never append to or modify LEARNINGS.md from here.
