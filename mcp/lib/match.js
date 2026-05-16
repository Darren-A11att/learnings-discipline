// Scorer for learnings_relevant_sections.
//
// Per architecture doc §7 "scoring algorithm":
//   +10  exact-match keyword hit in M3 trigger list
//   +8   symptom phrase substring match (M4 list)
//   +0–5 TF-IDF similarity between query and section body
//   +6   heading verbatim appears in the query
//
// Deterministic, stable, no embeddings.

// A modest default trigger list. Projects can override via env var in future;
// for v0.1 we use the union of generic + android-mod keywords from the gold
// reference CLAUDE.md.
const DEFAULT_KEYWORDS = [
  'smali','apktool','apksigner','zipalign','aab','xapk','split apk','native lib',
  '.so','loadlibrary','unsatisfiedlinkerror','abi','arm64','armeabi',
  'contentprovider','ad sdk','admob','applovin','pangle','pairip','vmp',
  'integrity check','license check','signature check','manifest scrub',
  'classnotfoundexception','anr','fatal exception','install-multiple',
  'install_failed','package rename','keystore','re-sign',
];

const DEFAULT_SYMPTOMS = [
  'black screen','failed to load','install failure','npe in','null pointer',
  'missing native lib','crashes on launch','keeps failing','silently fails',
];

const STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','of','to','in','on','at','for',
  'with','as','is','are','was','were','be','been','it','this','that','these',
  'those','i','you','we','they','my','our','your','their',
]);

function tokenize(s) {
  return s.toLowerCase().match(/[a-z0-9_]+/g) || [];
}

function tfidfScore(query, body, allSections) {
  // Compute a normalized overlap weighted by IDF (sections = doc corpus).
  const qTokens = tokenize(query).filter(t => !STOPWORDS.has(t));
  if (qTokens.length === 0) return 0;
  const bodyTokens = tokenize(body);
  const bodySet = new Set(bodyTokens);

  // Build doc frequencies once would be ideal; for simplicity recompute per
  // call. allSections is small (tens of sections), bodies short.
  const N = allSections.length || 1;
  let score = 0;
  for (const t of qTokens) {
    if (!bodySet.has(t)) continue;
    let df = 0;
    for (const s of allSections) {
      const sTokens = new Set(tokenize(s.body));
      if (sTokens.has(t)) df++;
    }
    const idf = Math.log((N + 1) / (df + 1)) + 1;
    // tf is just presence-weighted (term-frequency in body, normalized).
    const tf = bodyTokens.filter(x => x === t).length / Math.max(bodyTokens.length, 1);
    score += tf * idf;
  }
  // Map raw score into 0..5.
  const capped = Math.min(score * 50, 5);
  return capped;
}

export function score(query, section, allSections = [], opts = {}) {
  const keywords = opts.keywords || DEFAULT_KEYWORDS;
  const symptoms = opts.symptoms || DEFAULT_SYMPTOMS;

  const qLower = query.toLowerCase();
  let total = 0;

  // (+10) keyword exact match
  for (const k of keywords) {
    if (qLower.includes(k.toLowerCase())) {
      total += 10;
      break; // single keyword bonus; avoid runaway scores
    }
  }

  // (+8) symptom phrase substring match
  for (const s of symptoms) {
    if (qLower.includes(s.toLowerCase())) {
      total += 8;
      break;
    }
  }

  // (+6) heading verbatim in query
  if (section.heading && qLower.includes(section.heading.toLowerCase())) {
    total += 6;
  }

  // (+0..5) TF-IDF
  total += tfidfScore(query, section.body || '', allSections);

  return total;
}

export function rank(query, sections, opts = {}) {
  const scored = sections.map(s => ({
    section: s,
    score: score(query, s, sections, opts),
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Stable tiebreak by heading.
    return a.section.heading.localeCompare(b.section.heading);
  });
  return scored;
}
