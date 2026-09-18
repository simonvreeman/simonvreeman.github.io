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

test('the WebMCP bundle is loaded only when the API exists', () => {
  // Guard the LOAD, not just the registration: a visitor whose browser has no WebMCP must download
  // nothing at all, not a script that returns early. Matched by reading the inline scripts rather
  // than by pinning a shape, so the guard stays free to be an IIFE, to carry its rationale, or to
  // grow a second branch — what is asserted is that the feature check precedes the load.
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).find(s => s.includes('webmcp.js'));
  assert.ok(inline, 'an inline script injects webmcp.js');
  assert.match(inline, /document\.modelContext/, 'checks the current surface');
  assert.match(inline, /navigator\.modelContext/, 'and the earlier draft');
  assert.ok(inline.indexOf('modelContext') < inline.indexOf('webmcp.js'), 'the feature check comes before the load');
  assert.ok(!/<script[^>]*\bsrc="webmcp\.js"/.test(html), 'never loaded unconditionally');
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

  // Book sections are in order inside <main> and sections never nest; direct parentage is checked in the last test.
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

test('page hooks the mount point and the toggle focus style rely on', () => {
  // mountSearch() inserts the widget right after <header id="header">, so the toggle follows the skip link in Tab order.
  assert.match(html, /<header id="header">\s*<a href="#introduction" class="skip-to-main-content-link">/);
  // The closed toggle needs its own keyboard-focus colour in both schemes: the global :focus ring is too faint on the white disc.
  assert.equal((html.match(/#search-toggle:focus-visible/g) || []).length, 2, 'light and dark focus-visible rules');
  // The widget now precedes the .fixed back-to-top link in the DOM, so it must out-stack it (both are position: fixed).
  assert.match(html, /\.search \{[^}]*z-index: 11;/, '.search stacks above .fixed (z-index 10)');
});

test('page hooks the keyboard and phone behaviour rely on', () => {
  // Enter in the field moves focus to the first result; the phone keyboard labels the key accordingly.
  assert.match(html, /<input id="search-input" type="search" enterkeyhint="search"/);
  // The panel height follows the visual viewport (set as --vvh by mountSearch) so the keyboard does not cover it.
  assert.match(html, /#search-panel \{[^}]*max-height: min\(70dvh, calc\(var\(--vvh, 100dvh\) - 4\.5rem\)\);/);
  // body sets "onum" 1; the labels must reset the low-level property or they render oldstyle in most fonts.
  assert.match(html, /#search-results a strong \{[^}]*font-feature-settings: 'lnum' on, 'tnum' on;/);
});

test('Book sections are direct children of main and every entry marker is inside a Book', () => {
  // buildIndex() selects `main > section[id]`: anything wrapping a Book would silently drop it from the index.
  const inner = html.slice(html.indexOf('<main>') + 6, html.indexOf('</main>'));
  assert.match(inner.replace(/<section id="[\w-]+">[\s\S]*?<\/section>/g, ''), /^\s*$/, '<main> holds only top-level sections');
  // A marker moved out of its Book keeps the whole-file count but drops out of the index.
  const marker = /<(?:h3|strong) id="book\d+-\d+[a-z]?"/g;
  const inBooks = [...inner.matchAll(/<section id="book\d+">([\s\S]*?)<\/section>/g)]
    .reduce((n, [, body]) => n + (body.match(marker) || []).length, 0);
  assert.equal(inBooks, 499);
  assert.equal((html.match(marker) || []).length, inBooks, 'no entry markers outside the Books');
});

test('every h3/strong id inside a Book is entry-shaped', () => {
  // itemFromElement() takes the FIRST strong[id] in an element and only then tests it against
  // ENTRY_ID, so a <p> whose first strong[id] were a non-entry id yields marker: null and buildIndex()
  // drops that entry outright. The Node scanner's STRONG_ID instead finds the first strong whose id
  // already matches, so it would keep the entry — a silent divergence. Rather than pin parity on the
  // DOM's worse behaviour (losing an entry on purpose), assert the case cannot arise.
  const inner = html.slice(html.indexOf('<main>') + 6, html.indexOf('</main>'));
  const ids = [...inner.matchAll(/<section id="book\d+">([\s\S]*?)<\/section>/g)]
    .flatMap(([, body]) => [...body.matchAll(/<(?:h3|strong)\b[^>]*?\sid="([^"]*)"/g)].map(m => m[1]));
  assert.equal(ids.length, 499, 'no h3/strong carries an id beyond the 499 entry markers');
  assert.deepEqual(ids.filter(id => !/^book\d+-\d+[a-z]?$/.test(id)), [], 'no non-entry ids in the Books');
});
