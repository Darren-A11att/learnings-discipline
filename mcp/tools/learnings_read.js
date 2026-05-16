import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseHeadings } from '../lib/parse.js';

export default async function learnings_read(_args) {
  const project_dir = process.env.LEARNINGS_PROJECT_DIR || process.cwd();
  const path = join(project_dir, '.claude', 'LEARNINGS.md');
  if (!existsSync(path)) {
    return { file_contents: '', headings: [], project_dir, file_exists: false };
  }
  const text = readFileSync(path, 'utf8');
  const all = parseHeadings(text);
  const headings = all.filter(h => h.level === 2).map(h => ({
    name: h.name,
    line_start: h.line_start,
    line_end: h.line_end,
  }));
  return { file_contents: text, headings, project_dir, file_exists: true };
}

export const schema = {
  name: 'learnings_read',
  description:
    'Read the project\'s LEARNINGS.md (institutional memory). Returns the full markdown plus an index of H2 headings with line ranges. Call this when you need the whole file, or before searching, to confirm what sections exist.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};
