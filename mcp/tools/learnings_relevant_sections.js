import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseHeadings } from '../lib/parse.js';
import { rank } from '../lib/match.js';

export default async function learnings_relevant_sections(args) {
  const query = String(args?.query || '');
  const max_results = Number.isFinite(args?.max_results) ? args.max_results : 5;
  const project_dir = process.env.LEARNINGS_PROJECT_DIR || process.cwd();
  const path = join(project_dir, '.claude', 'LEARNINGS.md');
  if (!existsSync(path)) {
    return { matches: [], total_sections: 0 };
  }
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  const all = parseHeadings(text).filter(h => h.level === 2);

  const sections = all.map(h => ({
    heading: h.name,
    body: lines.slice(h.line_start, h.line_end).join('\n'),
    line_start: h.line_start,
    line_end: h.line_end,
  }));

  if (!query.trim()) {
    return { matches: [], total_sections: sections.length };
  }

  const ranked = rank(query, sections);
  const top = ranked.slice(0, max_results).filter(r => r.score > 0);
  const matches = top.map(r => {
    const firstPara = (r.section.body.split(/\n\s*\n/).find(p => p.trim().length > 0) || '').trim();
    return {
      heading: r.section.heading,
      score: Number(r.score.toFixed(3)),
      first_paragraph: firstPara.slice(0, 600),
      line_range: [r.section.line_start, r.section.line_end],
    };
  });
  return { matches, total_sections: sections.length };
}

export const schema = {
  name: 'learnings_relevant_sections',
  description:
    'Search the project\'s institutional memory for prior learnings relevant to a query. Pass the user\'s question or a topic phrase; you get back the top-N matching H2 sections from LEARNINGS.md with their headings, scores, first paragraphs, and line ranges. Use this before answering anything that touches a topic that might already be documented.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Topic, keyword, or symptom phrase to match against LEARNINGS.md.' },
      max_results: { type: 'number', description: 'Maximum number of matching sections to return. Default 5.' },
    },
    required: ['query'],
    additionalProperties: false,
  },
};
