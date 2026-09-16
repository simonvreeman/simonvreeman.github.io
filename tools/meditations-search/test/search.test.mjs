import test from 'node:test';
import assert from 'node:assert/strict';
import { groupEntries, normalizeText, findMatches, statusText, MIN_QUERY, snippet, SNIPPET_RADIUS } from '../../../meditations/search.js';

test('normalizeText collapses whitespace and trims', () => {
  assert.equal(normalizeText('  a \n\t b  '), 'a b');
});

test('groupEntries starts a new entry at each marker and appends continuation text', () => {
  const items = [
    { marker: null, text: 'Book 4' },                      // h2-like text before any marker is dropped
    { marker: 'book4-2', text: '§ 4.2 No random actions.' },
    { marker: 'book4-3', text: '§ 4.3 People try to get away from it all.' },
    { marker: null, text: 'By going within.' },
    { marker: null, text: '  ' },                          // empty continuation adds nothing
    { marker: 'book4-4', text: '4.4 If thought is common to us.' },
  ];
  const entries = groupEntries(items);
  assert.deepEqual(entries.map(e => e.id), ['book4-2', 'book4-3', 'book4-4']);
  assert.deepEqual(entries.map(e => e.label), ['4.2', '4.3', '4.4']);
  assert.equal(entries[0].text, 'No random actions.');
  assert.equal(entries[1].text, 'People try to get away from it all. By going within.');
  assert.equal(entries[2].text, 'If thought is common to us.');
  assert.equal(entries[1].lower, 'people try to get away from it all. by going within.');
});

test('groupEntries handles Book 1 h3 markers whose text carries § and a title', () => {
  const entries = groupEntries([
    { marker: 'book1-1', text: '§ 1.1 My grandfather Verus' },
    { marker: null, text: 'Character and self-control.' },
  ]);
  assert.equal(entries[0].label, '1.1');
  assert.equal(entries[0].text, 'My grandfather Verus Character and self-control.');
});

test('groupEntries ignores markers that are not bookN-M ids', () => {
  const entries = groupEntries([{ marker: 'introduction', text: 'x' }, { marker: 'book2-1', text: '2.1 Hi' }]);
  assert.deepEqual(entries.map(e => e.id), ['book2-1']);
});

const sample = groupEntries([
  { marker: 'book1-1', text: '1.1 My grandfather Verus' },
  { marker: null, text: 'Character and self-control.' },
  { marker: 'book4-3', text: '4.3 People try to get away from it all.' },
  { marker: null, text: 'complete tranquillity. And by tranquillity I mean a kind of harmony.' },
  { marker: 'book4-33', text: '4.33 Words once in common use now sound archaic.' },
]);

test('findMatches is case-insensitive substring search over entry text', () => {
  const { matches } = findMatches(sample, 'TRANQUIL');
  assert.deepEqual(matches.map(e => e.label), ['4.3']);
});

test('findMatches returns nothing below the minimum query length', () => {
  assert.equal(MIN_QUERY, 2);
  assert.deepEqual(findMatches(sample, 'a').matches, []);
  assert.deepEqual(findMatches(sample, '   ').matches, []);
  assert.equal(findMatches(sample, ' a ').query, 'a');
});

test('findMatches matches an exact entry label such as 4.3 without pulling in 4.33', () => {
  const { matches } = findMatches(sample, '4.3');
  assert.deepEqual(matches.map(e => e.label), ['4.3']);
});

test('findMatches keeps document order and lower-cases the query', () => {
  const r = findMatches(sample, 'O');       // too short → empty, but query is normalised
  assert.equal(r.query, 'o');
  const { matches } = findMatches(sample, 'co');
  assert.deepEqual(matches.map(e => e.label), ['1.1', '4.3', '4.33']);
});

test('statusText pluralises', () => {
  assert.equal(statusText(0), 'No entries match');
  assert.equal(statusText(1), '1 entry matches');
  assert.equal(statusText(12), '12 entries match');
});

test('snippet centres on the first hit and marks ellipses only where text was cut', () => {
  const entry = groupEntries([{ marker: 'book9-9', text: '9.9 Omitted beforehand tranquillity afterwards omitted' }])[0];
  const s = snippet(entry, 'tranquillity', 10);
  assert.equal(s.before, 'beforehand ');
  assert.equal(s.hit, 'tranquillity');
  assert.equal(s.after, ' afterwards');
  assert.equal(s.leading, true);
  assert.equal(s.trailing, true);
});

test('snippet preserves original casing of the hit', () => {
  const entry = groupEntries([{ marker: 'book1-1', text: '1.1 My grandfather Verus' }])[0];
  const s = snippet(entry, 'verus');
  assert.equal(s.hit, 'Verus');
  assert.equal(s.before, 'My grandfather ');
  assert.equal(s.after, '');
  assert.equal(s.leading, false);
  assert.equal(s.trailing, false);
});

test('snippet for a label-only match shows the opening of the entry with no hit', () => {
  const prefix = 'word '.repeat(27);
  const entry = groupEntries([{ marker: 'book4-3', text: '4.3 ' + prefix + 'tranquillity continues' }])[0];
  const s = snippet(entry, '4.3');
  assert.equal(s.hit, '');
  assert.equal(s.before, prefix + 'tranquillity');
  assert.equal(s.leading, false);
  assert.equal(s.trailing, true);
});

test('snippet expands to entry edges without ellipses and preserves a substring hit', () => {
  const entry = groupEntries([{ marker: 'book1-1', text: '1.1 beforehand tranquillity afterwards' }])[0];
  const s = snippet(entry, 'quill', 7);
  assert.equal(s.before, 'beforehand tran');
  assert.equal(s.hit, 'quill');
  assert.equal(s.after, 'ity afterwards');
  assert.equal(s.leading, false);
  assert.equal(s.trailing, false);
});

test('snippet keeps cuts already at word boundaries', () => {
  const entry = groupEntries([{ marker: 'book1-1', text: '1.1 omit calm hit calm omit' }])[0];
  const s = snippet(entry, 'hit', 5);
  assert.equal(s.before, 'calm ');
  assert.equal(s.after, ' calm');
  assert.equal(s.leading, true);
  assert.equal(s.trailing, true);
});

test('normalizeText treats undefined and null as empty', () => {
  assert.equal(normalizeText(undefined), '');
  assert.equal(normalizeText(null), '');
});

test('groupEntries indexes lettered sub-entries such as 4.49a as their own entry', () => {
  const entries = groupEntries([{ marker: 'book4-49a', text: '4.49a—It’s unfortunate that this has happened.' }]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'book4-49a');
  assert.equal(entries[0].label, '4.49a');
  assert.equal(entries[0].text, '—It’s unfortunate that this has happened.');
  assert.deepEqual(findMatches(entries, '4.49a').matches.map(e => e.id), ['book4-49a']);
});

test('groupEntries only strips the label when it is followed by a non-digit', () => {
  const entries = groupEntries([{ marker: 'book4-3', text: '4.33 not this label' }]);
  assert.equal(entries[0].text, '4.33 not this label');
});

test('findMatches folds typographic quotes while snippet keeps the original text', () => {
  const entries = groupEntries([
    { marker: 'book2-1', text: '2.1 I don’t know why.' },
    { marker: 'book4-14', text: '4.14 The “logos” is common.' },
  ]);
  const r = findMatches(entries, "don't");
  assert.deepEqual(r.matches.map(e => e.label), ['2.1']);
  assert.equal(snippet(r.matches[0], r.query).hit, 'don’t');
  const q = findMatches(entries, '"logos"');
  assert.deepEqual(q.matches.map(e => e.label), ['4.14']);
  assert.equal(snippet(q.matches[0], q.query).hit, '“logos”');
});
