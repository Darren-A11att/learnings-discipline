import assert from 'node:assert/strict';
import { score, rank } from '../lib/match.js';

const sections = [
  {
    heading: 'Architecture matters — the v7a vs arm64 lesson',
    body: 'First attempt: APKPure xapk bundle. Splits inside were armeabi-v7a only. Target device is Dimensity 9400 — 64-bit-only silicon, no AArch32 userspace. Install rejected with INSTALL_FAILED_NO_MATCHING_ABIS.',
    line_start: 10, line_end: 20,
  },
  {
    heading: 'Toolchain setup',
    body: 'apktool at /opt/homebrew/bin/apktool. adb at /opt/homebrew/bin/adb. Java 21 home.',
    line_start: 30, line_end: 40,
  },
  {
    heading: 'Unrelated cooking notes',
    body: 'Sear the steak hot and fast. Rest five minutes.',
    line_start: 50, line_end: 60,
  },
];

// Keyword match: "arm64" should boost the architecture section.
const s1 = score('the install keeps failing on arm64', sections[0], sections);
const s2 = score('the install keeps failing on arm64', sections[2], sections);
assert.ok(s1 > s2, 'arm64 section should outscore cooking section');
assert.ok(s1 >= 10, 'should get +10 keyword bonus');

// Symptom match: "install failure" → +8
const sympScore = score('we are seeing an install failure', sections[0], sections);
assert.ok(sympScore >= 8);

// Heading verbatim presence: query contains heading text → +6
const headingScore = score('Tell me about Toolchain setup please', sections[1], sections);
assert.ok(headingScore >= 6);

// Determinism
const a = score('arm64 abi', sections[0], sections);
const b = score('arm64 abi', sections[0], sections);
assert.equal(a, b, 'score must be deterministic');

// rank returns sorted, highest first
const ranked = rank('INSTALL_FAILED_NO_MATCHING_ABIS arm64', sections);
assert.equal(ranked[0].section.heading, 'Architecture matters — the v7a vs arm64 lesson');
assert.ok(ranked[0].score >= ranked[1].score);

// Empty / no-match query yields zero or low scores for cooking
const lowScore = score('totally unrelated query', sections[2], sections);
assert.ok(lowScore < 5, `cooking score on unrelated query should be low, got ${lowScore}`);

console.log('test_match: OK');
