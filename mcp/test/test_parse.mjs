import assert from 'node:assert/strict';
import { parseHeadings, extractSection, splitParagraphs, countWords } from '../lib/parse.js';

const doc = `# Title

Intro paragraph.

## Alpha

Alpha body line 1.
Alpha body line 2.

## Beta

Beta body.

### Beta sub

Nested.

## Gamma

Gamma body.
`;

const headings = parseHeadings(doc);
// We expect H1=Title, H2=Alpha, H2=Beta, H3=Beta sub, H2=Gamma => 5 entries
assert.equal(headings.length, 5, 'should find 5 headings');
assert.equal(headings[0].level, 1);
assert.equal(headings[0].name, 'Title');
assert.equal(headings[1].name, 'Alpha');
assert.equal(headings[1].level, 2);
assert.equal(headings[3].level, 3);
assert.equal(headings[3].name, 'Beta sub');

// line_end of Alpha should be the line before "## Beta"
const alpha = headings.find(h => h.name === 'Alpha');
const beta = headings.find(h => h.name === 'Beta');
assert.equal(alpha.line_end, beta.line_start - 1);

// extractSection by exact name
const sec = extractSection(doc, 'Alpha');
assert.ok(sec, 'extractSection returns object');
assert.ok(sec.body.includes('Alpha body line 1'));
assert.ok(!sec.body.includes('Beta body'));
assert.equal(sec.line_start, alpha.line_start);
assert.equal(sec.line_end, alpha.line_end);

// substring fallback
const sec2 = extractSection(doc, 'gamm');
assert.ok(sec2);
assert.equal(sec2.heading, 'Gamma');

// not found
assert.equal(extractSection(doc, 'NotThere'), null);

// code fences must not be parsed as headings
const fenced = `## Real

\`\`\`
# not a heading
## also not
\`\`\`

Body.

## After
`;
const fh = parseHeadings(fenced);
assert.equal(fh.filter(h => h.level === 2).length, 2, 'fenced "##" must not be a heading');
assert.deepEqual(fh.filter(h => h.level === 2).map(h => h.name), ['Real', 'After']);

// splitParagraphs
const paras = splitParagraphs(`one\n\ntwo\nstill two\n\nthree`);
assert.equal(paras.length, 3);
assert.equal(paras[1], 'two\nstill two');

// countWords
assert.equal(countWords('hello world  foo'), 3);
assert.equal(countWords(''), 0);

console.log('test_parse: OK');
