import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseHeadings } from '../lib/parse.js';

const TARGET_PATTERNS = ['things that did not work', 'things that did not work and why'];

export default async function learnings_capture_failure(args) {
  const tried = String(args?.tried || '').trim();
  const failed_because = String(args?.failed_because || '').trim();
  const mitigation = String(args?.mitigation || '').trim();
  if (!tried || !failed_because || !mitigation) {
    return { error: { code: 'MISSING_FIELD', message: 'tried, failed_because, and mitigation are all required' }, written: false, section_line: -1 };
  }

  const project_dir = process.env.LEARNINGS_PROJECT_DIR || process.cwd();
  const path = join(project_dir, '.claude', 'LEARNINGS.md');
  if (!existsSync(path)) {
    return { error: { code: 'FILE_MISSING', message: 'LEARNINGS.md not found; run /learn init first' }, written: false, section_line: -1 };
  }
  const text = readFileSync(path, 'utf8');
  const headings = parseHeadings(text).filter(h => h.level === 2);
  let target = null;
  for (const p of TARGET_PATTERNS) {
    target = headings.find(h => h.name.toLowerCase().includes(p));
    if (target) break;
  }
  if (!target) {
    return { error: { code: 'SECTION_NOT_FOUND', message: 'No "Things that did NOT work" section found' }, written: false, section_line: -1 };
  }

  const bullet = `- **${tried}** — failed because ${failed_because}. Mitigation: ${mitigation}.`;
  const lines = text.split('\n');
  // Insert bullet at the end of the section body, before the next H2 or EOF.
  let insertAt = target.line_end; // 1-indexed end line; insert before lines[insertAt]
  // Trim trailing blank lines inside the section.
  while (insertAt > target.line_start && lines[insertAt - 1].trim() === '') insertAt--;
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  // Ensure a newline separation.
  const prevLine = before[before.length - 1] || '';
  const sep = (prevLine.startsWith('- ') || prevLine.trim() === '') ? [] : [''];
  const newLines = [...before, ...sep, bullet, ...after];
  writeFileSync(path, newLines.join('\n'), 'utf8');
  return { written: true, section_line: target.line_start };
}

export const schema = {
  name: 'learnings_capture_failure',
  description:
    'Append a single failure entry to LEARNINGS.md\'s "Things that did NOT work" section. Use this immediately after a dead-end pivot so the next session doesn\'t repeat the same mistake. All three fields (tried, failed_because, mitigation) are required.',
  inputSchema: {
    type: 'object',
    properties: {
      tried: { type: 'string', description: 'Short label of what was attempted.' },
      failed_because: { type: 'string', description: 'Why it failed; one sentence.' },
      mitigation: { type: 'string', description: 'What to do instead; one sentence.' },
    },
    required: ['tried', 'failed_because', 'mitigation'],
    additionalProperties: false,
  },
};
