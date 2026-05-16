import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parseHeadings } from '../lib/parse.js';
import { validateAppend } from '../lib/audit.js';

export default async function learnings_append_section(args) {
  const heading = String(args?.heading || '').trim();
  const body = String(args?.body || '');
  const position = args?.position || 'end';

  const v = validateAppend({ heading, body });
  if (!v.ok) {
    return { error: { code: 'INVALID_SECTION', message: 'M9 validation failed' }, written: false, warnings: v.warnings, line_inserted: -1 };
  }

  const project_dir = process.env.LEARNINGS_PROJECT_DIR || process.cwd();
  const path = join(project_dir, '.claude', 'LEARNINGS.md');
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `# LEARNINGS\n\n`, 'utf8');
  }
  const text = readFileSync(path, 'utf8');
  const headings = parseHeadings(text).filter(h => h.level === 2);

  if (headings.some(h => h.name === heading)) {
    return { error: { code: 'DUPLICATE_HEADING', message: `Section "${heading}" already exists` }, written: false, warnings: v.warnings, line_inserted: -1 };
  }

  const lines = text.split('\n');
  const newSection = `## ${heading}\n\n${body.replace(/\s+$/, '')}\n`;

  let insertAt = lines.length; // line index (0-based), end of file
  if (position === 'end') {
    insertAt = lines.length;
  } else if (position.startsWith('after:')) {
    const target = position.slice('after:'.length).trim();
    const t = headings.find(h => h.name === target) || headings.find(h => h.name.toLowerCase().includes(target.toLowerCase()));
    if (!t) {
      return { error: { code: 'TARGET_NOT_FOUND', message: `position target "${target}" not found` }, written: false, warnings: v.warnings, line_inserted: -1 };
    }
    insertAt = t.line_end; // insert just after this section ends
  }

  // Ensure a blank line before the new section.
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  let prefix = before;
  if (prefix.length > 0 && prefix[prefix.length - 1].trim() !== '') {
    prefix = [...prefix, ''];
  }
  const newLines = [...prefix, ...newSection.split('\n'), ...after];
  const lineInserted = prefix.length + 1; // 1-indexed line of the new ## heading

  writeFileSync(path, newLines.join('\n'), 'utf8');
  return { written: true, warnings: v.warnings, line_inserted: lineInserted };
}

export const schema = {
  name: 'learnings_append_section',
  description:
    'Append a new H2 section to LEARNINGS.md. The tool validates M9 constraints (no nested H3+, no paragraph > 200 words) and refuses on duplicate headings. Use this whenever you have a new failure mode, working pattern, or refinement to record.',
  inputSchema: {
    type: 'object',
    properties: {
      heading: { type: 'string', description: 'H2 section title (no leading "##"). Must be unique.' },
      body: { type: 'string', description: 'Markdown body. Do not include the H2 line itself. No H3+ headings.' },
      position: { type: 'string', description: 'Where to insert. "end" (default) or "after:<existing heading>".' },
    },
    required: ['heading', 'body'],
    additionalProperties: false,
  },
};
