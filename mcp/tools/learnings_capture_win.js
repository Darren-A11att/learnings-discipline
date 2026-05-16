import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseHeadings } from '../lib/parse.js';

const FALLTHROUGH = ['what worked', 'common patterns', 'methodology that worked'];

export default async function learnings_capture_win(args) {
  const approach = String(args?.approach || '').trim();
  const why_it_worked = String(args?.why_it_worked || '').trim();
  const when_to_use = String(args?.when_to_use || '').trim();
  if (!approach || !why_it_worked || !when_to_use) {
    return { error: { code: 'MISSING_FIELD', message: 'approach, why_it_worked, and when_to_use are required' }, written: false, section_line: -1 };
  }

  const project_dir = process.env.LEARNINGS_PROJECT_DIR || process.cwd();
  const path = join(project_dir, '.claude', 'LEARNINGS.md');
  if (!existsSync(path)) {
    return { error: { code: 'FILE_MISSING', message: 'LEARNINGS.md not found; run /learn init first' }, written: false, section_line: -1 };
  }
  const text = readFileSync(path, 'utf8');
  const headings = parseHeadings(text).filter(h => h.level === 2);

  let target = null;
  for (const p of FALLTHROUGH) {
    target = headings.find(h => h.name.toLowerCase().includes(p));
    if (target) break;
  }
  if (!target) {
    return { error: { code: 'SECTION_NOT_FOUND', message: 'No "What worked" / "Common patterns" / "Methodology that worked" section found' }, written: false, section_line: -1 };
  }

  const bullet = `- **${approach}** — worked because ${why_it_worked}. Use when: ${when_to_use}.`;
  const lines = text.split('\n');
  let insertAt = target.line_end;
  while (insertAt > target.line_start && lines[insertAt - 1].trim() === '') insertAt--;
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  const prevLine = before[before.length - 1] || '';
  const sep = (prevLine.startsWith('- ') || prevLine.trim() === '') ? [] : [''];
  const newLines = [...before, ...sep, bullet, ...after];
  writeFileSync(path, newLines.join('\n'), 'utf8');
  return { written: true, section_line: target.line_start };
}

export const schema = {
  name: 'learnings_capture_win',
  description:
    'Append a single win entry to LEARNINGS.md\'s "What worked" (or "Common patterns" / "Methodology that worked") section. Use this when an approach succeeded and the next session should reach for it first.',
  inputSchema: {
    type: 'object',
    properties: {
      approach: { type: 'string', description: 'Short label of the working approach.' },
      why_it_worked: { type: 'string', description: 'Why it worked; one sentence.' },
      when_to_use: { type: 'string', description: 'Conditions under which to reach for it.' },
    },
    required: ['approach', 'why_it_worked', 'when_to_use'],
    additionalProperties: false,
  },
};
