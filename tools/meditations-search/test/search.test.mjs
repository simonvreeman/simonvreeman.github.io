import test from 'node:test';
import assert from 'node:assert/strict';
import { groupEntries, normalizeText } from '../../../meditations/search.js';

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
