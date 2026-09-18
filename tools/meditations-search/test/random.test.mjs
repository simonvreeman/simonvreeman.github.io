import test from 'node:test';
import assert from 'node:assert/strict';
import { h, Document } from './fake-dom.mjs';
import { buildRandomEntries, randomEntry, currentEntryId } from '../../../meditations/search.js';

test('random uses an 80/20 pool split, independent of pool sizes', () => {
  const entries = [{ id: 'marked', marked: true }, ...Array.from({ length: 9 }, (_, i) => ({ id: `plain${i}`, marked: false }))];
  let marked = 0;
  for (let i = 0; i < 100; i++) {
    const values = [i / 100, 0.99];
    const entry = randomEntry(entries, null, () => values.shift());
    if (entry.marked) marked++;
    else assert.equal(entry.id, 'plain8');
  }
  assert.equal(marked, 80);
});

test('random excludes the current entry, falls back to either pool, and handles no candidates', () => {
  const entries = [{ id: 'marked', marked: true }, { id: 'plain', marked: false }];
  assert.equal(randomEntry(entries, 'marked', () => 0).id, 'plain');
  assert.equal(randomEntry(entries, 'plain', () => 0.99).id, 'marked');
  assert.equal(randomEntry([], null), null);
  assert.equal(randomEntry([entries[0]], 'marked'), null);
});

test('random groups continuation marks with their entry and excludes non-Book material', () => {
  const doc = new Document();
  doc.body.append(h('main', {},
    h('section', { id: 'introduction' }, h('p', {}, h('mark', {}, 'Intro'))),
    h('section', { id: 'book1' },
      h('h3', { id: 'book1-1' }, '1.1'),
      h('p', {}, h('mark', {}, 'Marked continuation')),
      h('h3', { id: 'book1-2' }, '1.2'), h('p', {}, 'Unmarked')),
    h('section', { id: 'book4' },
      h('p', {}, h('strong', { id: 'book4-49a' }, '4.49a'), h('mark', {}, 'Marked'))),
    h('section', { id: 'book13' }, h('h3', { id: 'book13-1' }, 'Excluded'))));
  assert.deepEqual(buildRandomEntries(doc).map(({ id, marked }) => ({ id, marked })), [
    { id: 'book1-1', marked: true }, { id: 'book1-2', marked: false }, { id: 'book4-49a', marked: true },
  ]);
});

test('current entry follows the reading line and excludes sections scrolled past', () => {
  const section = { getBoundingClientRect: () => ({ top: -200, bottom: 900 }) };
  const entries = [-200, 80, 500].map((top, i) => ({
    id: `book2-${i + 1}`, section, marker: { getBoundingClientRect: () => ({ top }) },
  }));
  assert.equal(currentEntryId(entries), 'book2-2');
  section.getBoundingClientRect = () => ({ top: -1000, bottom: -100 });
  assert.equal(currentEntryId(entries), null);
});
