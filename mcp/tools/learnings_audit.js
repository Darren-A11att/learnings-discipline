import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseHeadings } from '../lib/parse.js';
import { auditClaudeMd, auditLearningsMd, findBrokenXrefs } from '../lib/audit.js';

export default async function learnings_audit(_args) {
  const project_dir = process.env.LEARNINGS_PROJECT_DIR || process.cwd();
  const claudePath = join(project_dir, '.claude', 'CLAUDE.md');
  const learningsPath = join(project_dir, '.claude', 'LEARNINGS.md');

  const claudeText = existsSync(claudePath) ? readFileSync(claudePath, 'utf8') : '';
  const learningsText = existsSync(learningsPath) ? readFileSync(learningsPath, 'utf8') : '';

  const cm = auditClaudeMd(claudeText);
  const headings = parseHeadings(learningsText);
  const lm = auditLearningsMd(learningsText, headings);
  const broken_xrefs = findBrokenXrefs(learningsText, headings);

  let overall = 'PASS';
  if (!cm.m1_intact || !cm.m5_intact || !cm.m7_intact) overall = 'FAIL';
  else if (lm.structural_warnings.length > 0 || broken_xrefs.length > 0) overall = 'WARN';
  if (!existsSync(claudePath) || !existsSync(learningsPath)) overall = 'FAIL';

  return {
    m1_intact: cm.m1_intact,
    m5_intact: cm.m5_intact,
    m7_intact: cm.m7_intact,
    privileged_sections: lm.privileged_sections,
    structural_warnings: lm.structural_warnings,
    stale_sections: lm.stale_sections,
    broken_xrefs,
    overall,
  };
}

export const schema = {
  name: 'learnings_audit',
  description:
    'Run a full structural audit of .claude/CLAUDE.md and .claude/LEARNINGS.md. Reports whether M1/M5/M7 anchors are intact, which privileged sections are present, structural warnings (H3 nesting, oversized paragraphs), stale sections, and broken §"…" cross-references. Returns overall PASS/WARN/FAIL.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
};
