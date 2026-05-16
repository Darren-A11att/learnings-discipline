// Audit functions for CLAUDE.md and LEARNINGS.md.
// Anchors are literal substrings per conventions in plugin LEARNINGS.md
// §"Template authoring conventions".

import { parseHeadings, splitParagraphs, countWords } from './parse.js';

export function auditClaudeMd(text) {
  return {
    m1_intact: text.includes('**MUST**'),
    m5_intact: text.includes('Do not silently re-derive'),
    m7_intact: text.includes('append a new section'),
  };
}

// Privileged section name *patterns* (substrings, case-insensitive) per M6.
const PRIVILEGED_PATTERNS = [
  'things that did not work',
  'common crash patterns',
  'common patterns',
  'common pitfalls',
  'what worked',
  'methodology that worked',
];

export function auditLearningsMd(text, headings = null) {
  headings = headings || parseHeadings(text);
  const h2 = headings.filter(h => h.level === 2);
  const h3plus = headings.filter(h => h.level >= 3);

  const privileged = PRIVILEGED_PATTERNS.map(p => ({
    name: p,
    present: h2.some(h => h.name.toLowerCase().includes(p)),
  }));

  const warnings = [];
  if (h3plus.length > 0) {
    warnings.push(`H3+ nesting found at lines ${h3plus.map(h => h.line_start).join(', ')}; M9 requires flat structure.`);
  }

  // Paragraph word count check (M9): paragraphs > 200 words.
  const paragraphs = splitParagraphs(text);
  for (const p of paragraphs) {
    if (p.startsWith('```')) continue; // skip code fences
    const wc = countWords(p);
    if (wc > 200) {
      warnings.push(`Paragraph > 200 words (${wc}): "${p.slice(0, 60).replace(/\n/g, ' ')}…"`);
    }
  }

  // Stale sections: v0.1 has no git integration, so empty array.
  const stale = [];

  // At least two privileged patterns should be present.
  const presentCount = privileged.filter(p => p.present).length;
  if (presentCount < 2) {
    warnings.push(`Only ${presentCount} privileged section pattern(s) present; M6 expects at least two.`);
  }

  return {
    privileged_sections: privileged,
    structural_warnings: warnings,
    stale_sections: stale,
  };
}

// Pre-append validation for new sections (M9).
export function validateAppend({ heading, body }) {
  const warnings = [];
  let ok = true;

  if (!heading || typeof heading !== 'string' || heading.trim() === '') {
    return { ok: false, warnings: ['heading is required and must be a non-empty string'] };
  }
  if (typeof body !== 'string') {
    return { ok: false, warnings: ['body must be a string'] };
  }

  // No H3+ nesting inside the body.
  const headings = parseHeadings(body);
  const nested = headings.filter(h => h.level >= 3);
  if (nested.length > 0) {
    ok = false;
    warnings.push(`body contains H3+ headings at lines ${nested.map(h => h.line_start).join(', ')}; M9 requires flat structure.`);
  }
  // No H1 or H2 inside the body either — the heading arg is the H2.
  const topLevel = headings.filter(h => h.level <= 2);
  if (topLevel.length > 0) {
    ok = false;
    warnings.push(`body must not contain its own H1/H2 headings; pass the heading via the heading arg.`);
  }

  // Paragraph word count.
  for (const p of splitParagraphs(body)) {
    if (p.startsWith('```')) continue;
    const wc = countWords(p);
    if (wc > 200) {
      ok = false;
      warnings.push(`paragraph > 200 words (${wc}); split it.`);
    }
  }

  return { ok, warnings };
}

// Detect broken cross-references like "see §5" or "LEARNINGS.md §\"Foo\"".
export function findBrokenXrefs(text, headings = null) {
  headings = headings || parseHeadings(text);
  const h2names = new Set(headings.filter(h => h.level === 2).map(h => h.name));
  const broken = [];
  // Match §"Something" patterns.
  const re = /§\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const target = m[1];
    if (!h2names.has(target) && ![...h2names].some(n => n.toLowerCase().includes(target.toLowerCase()))) {
      broken.push({ from: 'inline', to: target });
    }
  }
  return broken;
}
