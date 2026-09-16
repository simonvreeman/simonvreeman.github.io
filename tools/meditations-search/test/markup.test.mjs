import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../../meditations/index.html', import.meta.url), 'utf8');

test('page has exactly twelve Book sections and no others matching bookN', () => {
  const ids = [...html.matchAll(/<section id="(book\d+)">/g)].map(m => m[1]);
  assert.deepEqual(ids, Array.from({ length: 12 }, (_, i) => `book${i + 1}`));
});

test('entry markers: Book 1 uses h3 ids, Books 2–12 use strong ids, 499 in total', () => {
  const h3 = [...html.matchAll(/<h3 id="book(\d+)-\d+[a-z]?"/g)];
  const strong = [...html.matchAll(/<strong id="book(\d+)-\d+([a-z]?)"/g)];
  assert.equal(h3.length, 17);
  assert.ok(h3.every(m => m[1] === '1'), 'all h3 markers belong to Book 1');
  assert.equal(strong.length, 482);
  assert.ok(strong.every(m => m[1] !== '1'), 'no strong markers in Book 1');
  assert.equal(strong.filter(m => m[2]).length, 11, 'eleven lettered sub-entries such as 4.49a');
  assert.equal(h3.length + strong.length, 499);
});

test('search module is loaded as a module script before the closing body tag', () => {
  assert.match(html, /<script type="module" src="search\.js"><\/script>\s*<script>\s*window\.onload/);
});
