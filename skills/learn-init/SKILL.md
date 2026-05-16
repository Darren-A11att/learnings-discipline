---
name: learn-init
description: Scaffold a new project with the LEARNINGS.md consultation discipline. Use when the user runs `/learn init`, asks to initialize/bootstrap/set up the learnings-discipline plugin in a repo, asks to create a starter `.claude/CLAUDE.md` and `.claude/LEARNINGS.md`, or wants to install institutional-memory scaffolding for a project. Accepts an optional project-type (generic, android-mod, web-app, cli-tool, data-pipeline). Refuses to overwrite existing CLAUDE.md or LEARNINGS.md without `--force`.
argument-hint: "[project-type=generic|android-mod|web-app|cli-tool|data-pipeline] [--force]"
allowed-tools: Read, Write, Bash, mcp__learnings__template_get
disable-model-invocation: false
---

You are running the `/learn init` skill. Your job is to scaffold the LEARNINGS.md consultation discipline into the current project.

## Steps

1. **Parse arguments.**
   - First positional arg: `project-type`. Default `generic`. Valid: `generic`, `android-mod`, `web-app`, `cli-tool`, `data-pipeline`. If unrecognised, ask the user to pick one before proceeding.
   - Detect `--force` flag.

2. **Safety check.** Use `Read` (or `Bash` with `test -f`) to check whether `.claude/CLAUDE.md` or `.claude/LEARNINGS.md` already exist.
   - If either exists AND `--force` was NOT passed: STOP. Report which files exist and tell the user to re-run with `--force` to overwrite, or to delete/back-up the existing files first. Do not write anything.
   - If `--force` was passed: proceed but note in the final report that the files were overwritten.

3. **Fetch the CLAUDE.md template.** Call `mcp__learnings__template_get` with `{kind: "claudemd", project_type: <project-type>}`. The tool returns the template text plus a list of placeholders and any project-type defaults.

4. **Collect placeholder values.**
   - `{{PROJECT_NAME}}`: try to infer from `package.json` (`name` field), then `pyproject.toml`, then the basename of the git remote (`git remote get-url origin`), then the current directory name. Confirm the guess with the user before substituting.
   - `{{TRIGGER_KEYWORDS}}`: if the template's defaults for this project-type include a keyword list, use it. Otherwise ask the user for 5–15 keywords relevant to their domain.
   - `{{SYMPTOM_FINGERPRINTS}}`: same — use template defaults if provided, else prompt the user for 3–8 concrete symptom strings (crash messages, error patterns, observable failures).
   - For any other placeholders in the template, prefer defaults; ask the user if no default exists.

5. **Substitute placeholders** in the template text (simple string replacement).

6. **Write `.claude/CLAUDE.md`.** Create the `.claude/` directory if needed (`mkdir -p .claude`). Write the substituted text.

7. **Repeat for LEARNINGS.md.** Call `mcp__learnings__template_get` with `{kind: "learningsmd", project_type: <project-type>}`. Substitute the same placeholder values. Write to `.claude/LEARNINGS.md`.

8. **Optionally seed `.claude/thoughts/`.** Create the directory and write a one-line `README.md` inside it: `Brainstorm perspectives, plans, and retrospectives live here. See .claude/CLAUDE.md.` Only do this if `.claude/thoughts/` does not already exist.

9. **Report.** Print a concise summary listing:
   - The project-type used
   - The paths written (with `(overwritten)` annotation if applicable)
   - The placeholder values substituted
   - A reminder to review CLAUDE.md and customise the trigger-keyword list

## Defensiveness

Never silently overwrite. If the user passes a project-type you don't recognise, ask before guessing. If placeholder inference is ambiguous, ask before substituting.
