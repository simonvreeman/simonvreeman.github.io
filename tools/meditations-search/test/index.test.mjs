// The shipped meditations/entries.json is a generated artifact, so the obligation to rebuild it after
// editing the Books has to be enforced rather than remembered — that is what the deepEqual below is for.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEntries } from '../build-index.mjs';
import { withLower, findMatches } from '../../../meditations/search.js';

const html = readFileSync(new URL('../../../meditations/index.html', import.meta.url), 'utf8');
const raw = readFileSync(new URL('../../../meditations/entries.json', import.meta.url), 'utf8');
const shipped = JSON.parse(raw);

// The corpus ships { id, label, text } only: `lower` is derivable and would nearly double the file.
// findMatches() reads e.lower unconditionally, so a consumer puts it back with withLower() — the same
// helper groupEntries() itself ends with, never a re-implementation of its quote folding. Task 3's MCP
// server does the same. withLower() mutates, so give it copies and leave `shipped` as it was parsed.
const searchable = withLower(shipped.map(e => ({ ...e })));

test('the corpus has all 499 entries', () => {
  assert.equal(shipped.length, 499);
});

test('the shipped corpus is what the generator produces right now', () => {
  // Fails the moment meditations/index.html changes without a rebuild.
  assert.deepEqual(shipped, buildEntries(html));
});

test('the corpus is written one entry per line', () => {
  // Same bytes as a fully compact dump to within 0.2%, but a reworded entry shows up in `git diff` as
  // one changed line instead of a single 210 KB line. Guarded here because the formatting lives in
  // build-index.mjs's main(), which the round-trip above cannot see.
  assert.ok(raw.endsWith('\n'), 'file ends with a newline');
  const lines = raw.trimEnd().split('\n');
  assert.equal(lines[0], '[');
  assert.equal(lines.at(-1), ']');
  // Every line between the brackets is one whole entry — the property a streaming consumer relies on,
  // which subsumes both the line count and each line's shape. The separating commas are not checked
  // here: dropping one makes the file invalid JSON, so the parse at the top of this file catches it.
  assert.deepEqual(lines.slice(1, -1).map(l => JSON.parse(l.replace(/,$/, ''))), shipped);
});

test('ids and labels match the entry markers in the HTML, in document order', () => {
  const markers = [...html.matchAll(/<(?:h3|strong) id="(book\d+-\d+[a-z]?)"/g)].map(m => m[1]);
  assert.deepEqual(shipped.map(e => e.id), markers);
  assert.deepEqual(shipped.map(e => e.label), markers.map(m => m.replace(/^book(\d+)-/, '$1.')));
});

test('withLower adds `lower` without touching the text it indexes', () => {
  // If this drifted, every search below would be testing something other than the shipped text.
  assert.deepEqual(searchable.map(({ id, label, text }) => ({ id, label, text })), shipped);
  // snippet() slices entry.text by offsets found in entry.lower, so the two must stay index-aligned.
  assert.ok(searchable.every(e => typeof e.lower === 'string' && e.lower.length === e.text.length));
});

test('withLower is idempotent, so a consumer cannot corrupt the corpus by applying it twice', () => {
  // The reason to export it rather than rehydrate by re-running groupEntries() over its own output:
  // that strips a leading "§ N.M" a second time, truncating any entry whose text begins with its own
  // number. No entry does today, which is exactly why only a test keeps it that way.
  assert.deepEqual(withLower(withLower(shipped.map(e => ({ ...e })))), searchable);
});

test('no entity survived into the corpus', () => {
  const offender = shipped.find(e => /&[a-zA-Z][a-zA-Z0-9]*;|&#\d+;/.test(e.text));
  assert.equal(offender, undefined, `entity left in ${offender?.id}`);
});

test('no § return-link marker survived into the corpus', () => {
  const offender = shipped.find(e => e.text.includes('§'));
  assert.equal(offender, undefined, `§ left in ${offender?.id}`);
});

test('the leading entry number is stripped from the text', () => {
  const e = shipped.find(x => x.id === 'book2-1');
  assert.ok(!e.text.startsWith('2.1'), `text still starts with its label: ${e.text.slice(0, 20)}`);
});

test('words inside the Books are findable', () => {
  for (const word of ['Verus', 'tranquillity', 'logos', 'Antoninus']) {
    assert.ok(findMatches(searchable, word).matches.length > 0, `${word} should be in the Books`);
  }
});

test('words outside the Books are absent', () => {
  // Introduction, Notes and Index of Persons must never have leaked in.
  for (const word of ['Hays', 'Loeb', 'Haines', 'Farquharson']) {
    assert.equal(findMatches(searchable, word).matches.length, 0, `${word} is not in the Books`);
  }
});

test('an entry number matches its entry directly', () => {
  const { matches } = findMatches(searchable, '4.3');
  assert.equal(matches[0].id, 'book4-3');
});
