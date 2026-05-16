import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export default async function thoughts_create(args) {
  const slug = slugify(args?.slug || 'note');
  const content = String(args?.content || '');
  const kind = args?.kind === 'plan' ? 'plan' : 'perspective';

  const project_dir = process.env.LEARNINGS_PROJECT_DIR || process.cwd();
  const dir = join(project_dir, '.claude', 'thoughts');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let prefix;
  if (kind === 'plan') {
    prefix = '00';
  } else {
    // Scan existing 0NN-*.md files; pick max + 1, but >= 01.
    const entries = readdirSync(dir).filter(f => /^0\d+-.*\.md$/.test(f));
    let max = 0;
    for (const e of entries) {
      const m = /^(\d+)-/.exec(e);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > 0 && n > max) max = n; // ignore 00 (reserved for plans)
      }
    }
    const next = max + 1;
    prefix = String(next).padStart(2, '0');
  }

  const filename = `${prefix}-${slug}.md`;
  const path = join(dir, filename);
  if (existsSync(path)) {
    return { error: { code: 'FILE_EXISTS', message: `${filename} already exists` }, path, prefix_used: prefix };
  }
  writeFileSync(path, content, 'utf8');
  return { path, prefix_used: prefix };
}

export const schema = {
  name: 'thoughts_create',
  description:
    'Create a new file in .claude/thoughts/. Perspectives get the next available 0NN prefix; plans are always prefixed 00. Use this when capturing a brainstormed perspective from a sub-agent or writing a plan that drives later work.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Short kebab-case slug for the filename.' },
      content: { type: 'string', description: 'Full markdown content.' },
      kind: { type: 'string', enum: ['perspective', 'plan'], description: 'Default "perspective".' },
    },
    required: ['slug', 'content'],
    additionalProperties: false,
  },
};
