// Tiny markdown parser for LEARNINGS.md-style flat docs (M9).
// Only handles ATX headings (#, ##, ###...). Code fences are respected: lines
// inside ``` ... ``` are not parsed as headings.

export function parseHeadings(text) {
  const lines = text.split('\n');
  const headings = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    headings.push({
      level: m[1].length,
      name: m[2].trim(),
      line_start: i + 1, // 1-indexed
      line_end: 0, // filled in below
    });
  }
  // line_end of heading N = (line_start of heading N+1) - 1, or last line
  for (let i = 0; i < headings.length; i++) {
    headings[i].line_end = i + 1 < headings.length
      ? headings[i + 1].line_start - 1
      : lines.length;
  }
  return headings;
}

// extractSection finds an H2 by exact heading text (or substring match if no
// exact match) and returns its body (excluding the heading line itself).
export function extractSection(text, heading) {
  const headings = parseHeadings(text);
  const lines = text.split('\n');
  let target = headings.find(h => h.level === 2 && h.name === heading);
  if (!target) {
    target = headings.find(h => h.level === 2 && h.name.toLowerCase().includes(heading.toLowerCase()));
  }
  if (!target) return null;
  // Body is everything after the heading line through line_end.
  const bodyLines = lines.slice(target.line_start, target.line_end);
  return {
    body: bodyLines.join('\n'),
    line_start: target.line_start,
    line_end: target.line_end,
    heading: target.name,
  };
}

export function splitParagraphs(text) {
  // Paragraphs split by blank lines. Code fences kept intact (as one paragraph).
  const out = [];
  const lines = text.split('\n');
  let buf = [];
  let inFence = false;
  const flush = () => { if (buf.length) { out.push(buf.join('\n')); buf = []; } };
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      buf.push(line);
      continue;
    }
    if (!inFence && line.trim() === '') {
      flush();
      continue;
    }
    buf.push(line);
  }
  flush();
  return out.filter(p => p.trim().length > 0);
}

export function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
