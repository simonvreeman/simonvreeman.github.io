import test from 'node:test';
import assert from 'node:assert/strict';
import { h, Document } from './fake-dom.mjs';
import { readingLine, currentEntryId } from '../../../meditations/search.js';
import { headingLabel } from '../../../meditations/breadcrumb.js';

test('mobile breadcrumb clearance is shared with shuffle and respects hidden controls', () => {
  const doc = new Document();
  assert.equal(readingLine(doc), 100);
  const trail = doc.body.appendChild(h('nav', { class: 'breadcrumb' }));
  trail.getBoundingClientRect = () => ({ bottom: 108 });
  assert.equal(readingLine(doc), 128);
  const section = { getBoundingClientRect: () => ({ top: -500, bottom: 800 }) };
  const entries = [80, 112, 300].map((top, i) => ({
    id: `book5-${i + 1}`, section, marker: { getBoundingClientRect: () => ({ top }) },
  }));
  assert.equal(currentEntryId(entries, readingLine(doc)), 'book5-2');
  trail.hidden = true;
  assert.equal(readingLine(doc), 100);
  assert.equal(currentEntryId(entries, readingLine(doc)), 'book5-1');
});

test('a passage remains current through continuation text, but ends at its book boundary', () => {
  let bottom = 1000;
  const section = { getBoundingClientRect: () => ({ top: -2000, bottom }) };
  const entries = [{ id: 'book4-49a', section, marker: { getBoundingClientRect: () => ({ top: -800 }) } }];
  assert.equal(currentEntryId(entries, 128), 'book4-49a');
  bottom = 128;
  assert.equal(currentEntryId(entries, 128), null);
});

test('editorial labels remove navigation symbols while preserving emphasized text', () => {
  const heading = h('h3', {}, h('a', {}, '§'), ' Stoicism and the ', h('em', {}, 'Meditations'), ' ', h('a', {}, '↑'));
  assert.equal(headingLabel(heading), 'Stoicism and the Meditations');
  assert.match(heading.textContent, /§/);
});
