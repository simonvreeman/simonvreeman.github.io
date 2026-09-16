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

test('search module is loaded as a module script', () => {
  assert.match(html, /<script type="module" src="search\.js"><\/script>/);
});

test('widget markup lives in the page, inside an inert template', () => {
  const m = /<template id="search-template">([\s\S]*?)<\/template>/.exec(html);
  assert.ok(m, 'the page carries <template id="search-template">');
  const tpl = m[1];

  // mountSearch() clones the first element child, so the widget needs a single root.
  assert.match(tpl, /<div id="search" class="search">/);
  assert.equal((tpl.match(/<div id="search"/g) || []).length, 1);

  // Every element mountSearch() looks up, with the roles screen readers depend on.
  assert.match(tpl, /<button id="search-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="search-panel"/);
  assert.match(tpl, /<div id="search-panel" role="search" hidden>/);
  assert.match(tpl, /<input id="search-input" type="search"/);
  assert.match(tpl, /<p id="search-status" role="status">/);
  assert.match(tpl, /<ol id="search-results" role="list">/);
  assert.match(tpl, /<svg[^>]*stroke="currentColor"/);
});

test('page hooks the search CSS and JS rely on', () => {
  // The print stylesheet hides the widget.
  assert.match(html, /@media print \{[\s\S]*?\.search[\s\S]*?display: none/);

  // Every Book section is a direct child of <main>: buildIndex() selects `main > section[id]`.
  const main = html.slice(html.indexOf('<main>'), html.indexOf('</main>'));
  const books = [...main.matchAll(/<section id="(book\d+)">/g)].map(m => m[1]);
  assert.deepEqual(books, Array.from({ length: 12 }, (_, i) => `book${i + 1}`));
  const tokens = main.match(/<section\b|<\/section>/g);
  assert.equal(tokens.filter(t => t === '<section').length, tokens.filter(t => t === '</section>').length);
  let depth = 0;
  for (const t of tokens) {
    depth += t === '<section' ? 1 : -1;
    assert.ok(depth >= 0 && depth <= 1, 'sections are never nested');
  }
});
