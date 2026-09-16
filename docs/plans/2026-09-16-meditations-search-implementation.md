# Meditations Books-only Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a client-side search to `meditations/index.html` that searches only Books 1–12, triggered by a fixed top-right icon (or Cmd/Ctrl+K), showing a results list of entry numbers plus snippets that stays open when a result is clicked.

**Architecture:** One small ES module, `meditations/search.js`, loaded with `<script type="module">` (deferred by default, so it never blocks the 500 KB page). Pure functions (grouping, matching, snippets, status text) are exported and unit-tested with `node:test`; the thin DOM layer (`visibleText`, `itemFromElement`, `buildIndex`, `mountSearch`) is verified in the built-in browser. A short CSS block goes into the page's existing inline `<style>`.

**Tech Stack:** Plain HTML/CSS/JS. Node 24 with the built-in `node:test` runner (repo convention: `node --test tools/<x>/test/*.test.mjs`). No dependencies. Local preview via `python3 -m http.server`.

**Design doc:** [2026-09-16-meditations-search-design.md](2026-09-16-meditations-search-design.md).

**One deviation from the design doc, chosen for testability:** the script is an external module `meditations/search.js` rather than an inline `<script>`. Cloudflare Pages serves `.js` as `text/javascript`; Node 24 imports an ESM `.js` file without a `package.json` (verified). The CSS stays inline as designed.

---

## Page facts you need (read before Task 1)

- `meditations/index.html` is one 3 274-line file. Inline `<style>` runs lines 10–280. `<main>` holds `<section id="chronology">`, `<section id="introduction">`, `<section id="book1">` … `<section id="book12">`, `<section id="notes">`, `<section id="persons">`. An existing inline `<script>` starts at line 3257, just before `</body>`.
- **Entry markers.** Book 1 (17 entries): `<h3 id="book1-N"><a href="#book1-N">§</a> 1.N Title <sup><a href="#…">i</a></sup></h3>` followed by `<p>` siblings. Books 2–12 (482 entries, 11 of which are sub-entries with a letter suffix such as `book4-49a` / `4.49a`): `<p><a href="#bookN-M" class="return">§</a> <strong id="bookN-M">N.M</strong> text…</p>` followed by continuation `<p>`, `<ul>`, `<blockquote>` siblings. Total **499** entries.
- Text to exclude from the index: `<sup>` footnote markers and `.return` § links. The Books use typographic quotes (774 `’`, 322 `“ ”`); matching folds them to straight quotes so a reader typing `don't` finds `don’t`. The entry number itself (`1.1`, `4.3`) is stripped from the start of the text because the result already shows the label.
- Existing fixed elements: `#progress` (top: 0, 2 px high) and `.fixed` back-to-top arrow (bottom right). Print CSS hides `.fixed` and `.return`.
- CSS variables: `--eigengrau` (dark), `--white`, `--blue-dark`, `--blue-light`, `--blue-lighter`, `--sans-serif`. Dark mode via `@media (prefers-color-scheme: dark)`. `mark` is styled in both schemes with `padding: .25rem; white-space: pre-wrap` (override inside results).
- Probe words verified with grep: **only outside the Books:** `Hays`, `Loeb`, `Haines`, `Farquharson`. **Inside the Books:** `Verus`, `tranquillity`, `logos`, `Antoninus`.

Run all tests at any time with:

```bash
node --test tools/meditations-search/test/*.test.mjs
```

---

### Task 1: Pure grouping — `groupEntries`

**Files:**
- Create: `meditations/search.js`
- Create: `tools/meditations-search/test/search.test.mjs`

**Step 1: Write the failing test**

Create `tools/meditations-search/test/search.test.mjs`:

```js
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
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test tools/meditations-search/test/*.test.mjs
```

Expected: FAIL with `Cannot find module …/meditations/search.js`.

**Step 3: Write minimal implementation**

Create `meditations/search.js`:

```js
// Search within Books 1–12 of the Meditations.
// Pure helpers are exported for tests (tools/meditations-search/test/).
// The DOM is only touched inside mountSearch(), which runs when a document exists.

const ENTRY_ID = /^book(\d+)-(\d+)$/;

export function normalizeText(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

// items: [{ marker: 'book4-3' | null, text: '…' }] in document order.
// Returns [{ id, label, text, lower }].
export function groupEntries(items) {
  const entries = [];
  let current = null;
  for (const item of items) {
    const m = item.marker ? ENTRY_ID.exec(item.marker) : null;
    let t = normalizeText(item.text);
    if (m) {
      current = { id: item.marker, label: `${m[1]}.${m[2]}`, text: '' };
      entries.push(current);
      // Drop the leading "§ 4.3" — the result list shows the label separately.
      t = t.replace(new RegExp(`^[§\\s]*${m[1]}\\.${m[2]}\\s*`), '');
    }
    if (!current || !t) continue;
    current.text = current.text ? `${current.text} ${t}` : t;
  }
  for (const e of entries) e.lower = e.text.toLowerCase();
  return entries;
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
node --test tools/meditations-search/test/*.test.mjs
```

Expected: `# pass 4`, `# fail 0`.

**Step 5: Commit**

```bash
git add meditations/search.js tools/meditations-search/test/search.test.mjs
git commit -m "feat(meditations): group Book entries for search index

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Matching and status text — `findMatches`, `statusText`

**Files:**
- Modify: `meditations/search.js`
- Modify: `tools/meditations-search/test/search.test.mjs`

**Step 1: Write the failing tests**

Update the import line and append to the test file:

```js
import { groupEntries, normalizeText, findMatches, statusText, MIN_QUERY } from '../../../meditations/search.js';
```

```js
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
```

**Step 2: Run tests to verify they fail**

Run:

```bash
node --test tools/meditations-search/test/*.test.mjs
```

Expected: FAIL — `findMatches`, `statusText`, `MIN_QUERY` are not exported (SyntaxError on import).

**Step 3: Write minimal implementation**

Add to `meditations/search.js` after `groupEntries`:

```js
export const MIN_QUERY = 2;

// Returns { query, matches }. query is the normalised, lower-cased term.
export function findMatches(entries, rawQuery) {
  const query = normalizeText(rawQuery).toLowerCase();
  if (query.length < MIN_QUERY) return { query, matches: [] };
  const matches = entries.filter(e => e.label === query || e.lower.includes(query));
  return { query, matches };
}

export function statusText(n) {
  if (n === 0) return 'No entries match';
  return n === 1 ? '1 entry matches' : `${n} entries match`;
}
```

**Step 4: Run tests to verify they pass**

Expected: `# pass 9`, `# fail 0`.

**Step 5: Commit**

```bash
git add meditations/search.js tools/meditations-search/test/search.test.mjs
git commit -m "feat(meditations): match entries by text or label

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Snippets — `snippet`

Returns text *pieces*, never HTML, so the renderer can build text nodes and a `<mark>` safely.

**Files:**
- Modify: `meditations/search.js`
- Modify: `tools/meditations-search/test/search.test.mjs`

**Step 1: Write the failing tests**

Add `snippet, SNIPPET_RADIUS` to the import, then append:

```js
test('snippet centres on the first hit and marks ellipses only where text was cut', () => {
  const entry = groupEntries([{ marker: 'book9-9', text: '9.9 ' + 'a'.repeat(100) + ' tranquillity ' + 'b'.repeat(100) }])[0];
  const s = snippet(entry, 'tranquillity', 10);
  assert.equal(s.before, 'aaaaaaaaa ');           // 10 chars before the hit
  assert.equal(s.hit, 'tranquillity');
  assert.equal(s.after, ' bbbbbbbbb');            // 10 chars after
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
  const entry = groupEntries([{ marker: 'book4-3', text: '4.3 ' + 'x'.repeat(300) }])[0];
  const s = snippet(entry, '4.3');
  assert.equal(s.hit, '');
  assert.equal(s.before.length, SNIPPET_RADIUS * 2);
  assert.equal(s.leading, false);
  assert.equal(s.trailing, true);
});
```

**Step 2: Run tests to verify they fail**

Expected: FAIL — `snippet` not exported.

**Step 3: Write minimal implementation**

Add to `meditations/search.js`:

```js
export const SNIPPET_RADIUS = 70;

// Pieces of entry.text around the first occurrence of query (already lower-cased).
export function snippet(entry, query, radius = SNIPPET_RADIUS) {
  const text = entry.text;
  const i = query ? entry.lower.indexOf(query) : -1;
  if (i < 0) {
    const cut = radius * 2;
    return { before: text.slice(0, cut), hit: '', after: '', leading: false, trailing: text.length > cut };
  }
  const start = Math.max(0, i - radius);
  const end = Math.min(text.length, i + query.length + radius);
  return {
    before: text.slice(start, i),
    hit: text.slice(i, i + query.length),
    after: text.slice(i + query.length, end),
    leading: start > 0,
    trailing: end < text.length,
  };
}
```

**Step 4: Run tests to verify they pass**

Expected: `# pass 12`, `# fail 0`.

**Step 5: Commit**

```bash
git add meditations/search.js tools/meditations-search/test/search.test.mjs
git commit -m "feat(meditations): build safe result snippets

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: DOM adapter + markup guard test

The DOM functions cannot run under `node:test` (no DOM). Instead this task adds a **markup guard test** that reads the real HTML and asserts the assumptions the adapter relies on (12 Book sections, 17 `h3` markers, 482 `strong` markers (11 with an `a` suffix), 499 total), so future edits to the page that break the search fail a test.

**Files:**
- Modify: `meditations/search.js`
- Create: `tools/meditations-search/test/markup.test.mjs`

**Step 1: Write the failing test**

Create `tools/meditations-search/test/markup.test.mjs`:

```js
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
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test tools/meditations-search/test/*.test.mjs
```

Expected: the first two markup tests PASS (they describe the page as it is); the third FAILS (script tag not yet added). Total `# fail 1`. If either of the first two fails, stop: the page markup differs from this plan's assumptions, re-check with `grep -c`.

**Step 3: Write the DOM adapter**

Add to `meditations/search.js` (below `snippet`):

```js
const BOOK_ID = /^book\d+$/;
const STRIP_SELECTOR = 'sup, .return'; // footnote markers and § return links

export function visibleText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll(STRIP_SELECTOR).forEach(n => n.remove());
  return normalizeText(clone.textContent || '');
}

// One item per direct child of a Book section.
export function itemFromElement(el) {
  let marker = null;
  if (el.tagName === 'H3' && ENTRY_ID.test(el.id)) {
    marker = el.id;
  } else {
    const strong = el.querySelector('strong[id]');
    if (strong && ENTRY_ID.test(strong.id)) marker = strong.id;
  }
  return { marker, text: visibleText(el) };
}

// Index only <section id="bookN"> inside <main>; everything else on the page is ignored.
export function buildIndex(doc) {
  const items = [];
  for (const section of doc.querySelectorAll('main section[id]')) {
    if (!BOOK_ID.test(section.id)) continue;
    for (const child of section.children) {
      if (child.tagName === 'H2') continue;
      items.push(itemFromElement(child));
    }
  }
  return groupEntries(items);
}
```

**Step 4: Add the module script tag to the page**

In `meditations/index.html`, line 3257 currently reads `<script>` (followed by `window.onload = function(){`). Insert the module tag immediately before it so the end of the body becomes:

```html
    <a class="fixed" href="#header" title="Back to top">↑</a>
<script type="module" src="search.js"></script>
<script>
window.onload = function(){
```

Use the Edit tool with `old_string` = `<a class="fixed" href="#header" title="Back to top">↑</a>\n<script>\nwindow.onload` and the corresponding `new_string`.

**Step 5: Run tests to verify they pass**

Expected: `# pass 15`, `# fail 0`.

**Step 6: Commit**

```bash
git add meditations/search.js meditations/index.html tools/meditations-search/test/markup.test.mjs
git commit -m "feat(meditations): index Books 1-12 from the DOM and load the module

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: UI — `mountSearch` and CSS

**Files:**
- Modify: `meditations/search.js`
- Modify: `meditations/index.html` (inline `<style>`, insert before `@media (prefers-reduced-motion: reduce)` at ~line 223)

**Step 1: Add `mountSearch` and the self-start guard**

Append to `meditations/search.js`:

```js
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';

export function mountSearch(doc) {
  const root = doc.createElement('div');
  root.id = 'search';
  root.className = 'search';
  root.innerHTML =
    `<button id="search-toggle" type="button" aria-label="Search the Books" title="Search Books 1–12 (⌘K / Ctrl+K)" aria-expanded="false" aria-controls="search-panel" aria-keyshortcuts="Meta+K Control+K">${ICON}</button>` +
    '<div id="search-panel" role="search" hidden>' +
    '<input id="search-input" type="search" placeholder="Search Books 1–12" autocomplete="off" spellcheck="false" aria-label="Search Books 1–12">' +
    '<p id="search-status" aria-live="polite"></p>' +
    '<ol id="search-results"></ol>' +
    '</div>';
  doc.body.appendChild(root);

  const toggle = root.querySelector('#search-toggle');
  const panel = root.querySelector('#search-panel');
  const input = root.querySelector('#search-input');
  const status = root.querySelector('#search-status');
  const results = root.querySelector('#search-results');
  let index = null; // built lazily on first open

  const isOpen = () => !panel.hidden;

  function open() {
    if (!index) index = buildIndex(doc);
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    input.focus();
    input.select();
  }

  function close(refocus) {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (refocus) toggle.focus();
  }

  function render() {
    const { query, matches } = findMatches(index, input.value);
    results.replaceChildren();
    if (query.length < MIN_QUERY) { status.textContent = ''; return; }
    status.textContent = statusText(matches.length);
    const frag = doc.createDocumentFragment();
    for (const entry of matches) {
      const li = doc.createElement('li');
      const a = doc.createElement('a');
      a.href = `#${entry.id}`;
      const strong = doc.createElement('strong');
      strong.textContent = entry.label;
      a.appendChild(strong);
      li.appendChild(a);

      const s = snippet(entry, query);
      const span = doc.createElement('span');
      span.className = 'search-snippet';
      span.append((s.leading ? '…' : '') + s.before);
      if (s.hit) {
        const mark = doc.createElement('mark');
        mark.textContent = s.hit;
        span.appendChild(mark);
      }
      span.append(s.after + (s.trailing ? '…' : ''));
      li.appendChild(span);
      frag.appendChild(li);
    }
    results.appendChild(frag);
  }

  toggle.addEventListener('click', () => (isOpen() ? close(false) : open()));
  input.addEventListener('input', render);

  doc.addEventListener('keydown', (ev) => {
    const k = ev.key.toLowerCase();
    if ((ev.metaKey || ev.ctrlKey) && !ev.altKey && !ev.shiftKey && k === 'k') {
      ev.preventDefault();
      open();
    } else if (ev.key === 'Escape' && isOpen()) {
      ev.preventDefault(); // also stops type=search from clearing the field
      close(true);
    }
  });

  // Click/tap outside the widget closes it; clicking a result (inside) keeps it open.
  doc.addEventListener('pointerdown', (ev) => {
    if (isOpen() && !root.contains(ev.target)) close(false);
  });

  return root;
}

if (typeof document !== 'undefined') mountSearch(document);
```

**Step 2: Run the unit tests — they must still pass in Node**

Run:

```bash
node --test tools/meditations-search/test/*.test.mjs
```

Expected: `# pass 19`, `# fail 0`. (This proves the module's top level is safe to import without a DOM.)

**Step 3: Add the CSS**

In `meditations/index.html`, insert this block inside the `<style>` immediately **before** the line `@media (prefers-reduced-motion: reduce) {` (use Edit with that line as the anchor):

```css
.search {
  position: fixed;
  top: .75rem;
  right: 1em;
  z-index: 10;
  font-family: var(--sans-serif);
  font-size: 1rem;
  line-height: 1.4;
}
#search-toggle {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  margin: 0 0 0 auto;
  padding: 0;
  border: 1px solid currentColor;
  border-radius: 50%;
  background-color: var(--white);
  color: inherit;
  cursor: pointer;
}
#search-panel {
  box-sizing: border-box;
  width: min(28em, calc(100vw - 2em));
  max-height: 70vh;
  margin-top: .5rem;
  padding: .75rem;
  overflow: auto;
  border: 1px solid currentColor;
  background-color: var(--white);
  color: inherit;
}
#search-input {
  box-sizing: border-box;
  width: 100%;
  padding: .5rem;
  border: 1px solid currentColor;
  border-radius: 0;
  background-color: transparent;
  color: inherit;
  font: inherit;
}
#search-status {
  margin: .5rem 0;
  font-size: .875rem;
}
#search-results {
  margin: 0;
  padding: 0;
  list-style: none;
}
#search-results li {
  padding: .5rem 0;
  border-top: 1px solid oklch(0.85 0.00 none / .6);
}
#search-results a {
  margin-right: .5em;
  text-decoration: none;
}
#search-results mark {
  padding: 0 .125rem;
  white-space: normal;
}
```

Then add two more rules:

- Inside the existing `@media (prefers-color-scheme: dark) {` block (after the `hr` rule): 
  ```css
  #search-toggle, #search-panel {
    background-color: var(--eigengrau);
  }
  ```
- Inside the existing `@media print {` block, change `.return, .fixed, footer, h1 a, h2 a, h3 a, h4 a, h5 a {` to `.return, .fixed, .search, footer, h1 a, h2 a, h3 a, h4 a, h5 a {`.

**Step 4: Commit**

```bash
git add meditations/search.js meditations/index.html
git commit -m "feat(meditations): search icon, panel, results and styling

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Browser verification and fixes

Use the built-in browser (`mcp__Claude_Browser__*`). Do not use screenshots to read text; use `read_page`, `find`, and `javascript_tool`.

**Step 1: Start a static server**

Run `python3 -m http.server 8765 --bind 127.0.0.1` from the repo root (Bash, `run_in_background`) and `navigate` the built-in browser to `http://localhost:8765/meditations/`. A `.claude/launch.json` + `preview_start` config was tried first but the launcher's child process is denied access to `~/Documents` on this Mac (macOS privacy permission), so it is not committed.

**Step 2: Index sanity (must equal the markup guard)**

Run with `javascript_tool`:

```js
const m = await import('/meditations/search.js');
const idx = m.buildIndex(document);
({ count: idx.length, first: idx[0], last: idx.at(-1), b43: idx.find(e => e.label === '4.3').text.slice(0, 80) })
```

Expected: `count: 499`, `first.label: "1.1"`, `first.text` starts with `My grandfather Verus Character and self-control.` (no `§`, no `1.1`, no `[i]`), `last.label: "12.36"`, `b43` starts with `People try to get away from it all`, and `idx.find(e => e.label === '4.49a').id === 'book4-49a'` with text starting `—It’s unfortunate`.

Also confirm nothing from outside the Books leaked:

```js
const m = await import('/meditations/search.js');
const idx = m.buildIndex(document);
['hays','loeb','haines','farquharson'].map(w => [w, idx.filter(e => e.lower.includes(w)).length])
```

Expected: all `0`.

Words must not fuse across `<br>` and tooltip titles must not be indexed:

```js
const m = await import('/meditations/search.js');
const idx = m.buildIndex(document);
({ br: idx.some(e => e.lower.includes('rain down on the land')), fused: idx.some(e => e.lower.includes('downon')), daily: idx.filter(e => e.lower.includes('daily stoic')).length })
```

Expected: `br: true`, `fused: false`, `daily: 0`.

Also time the index build once: `const t = performance.now(); m.buildIndex(document); performance.now() - t` — expect well under 50 ms.

**Step 3: Open via icon and probe**

1. `find` "Search the Books" → click the button. `read_page` must show the panel with an input focused (`document.activeElement.id === 'search-input'` via `javascript_tool`).
2. `form_input` the input with `Verus`, then read `#search-status` text. Expected: `N entries match` with N ≥ 2, and result list items whose first link text is an entry label like `1.1`.
3. Set input to `Hays`. Expected status: `No entries match`.
4. Set input to `4.3`. Expected: `1 entry matches`, link `4.3`, snippet starts `People try to get away from it all`.
5. Set input to `tranquillity`. Expected: several entries; each snippet contains a `<mark>` whose text is `tranquillity` (check with `javascript_tool`: `[...document.querySelectorAll('#search-results mark')].every(m => m.textContent.toLowerCase() === 'tranquillity')`).
6. Set input to `a`. Expected: status empty, no results.

**Step 4: Interaction**

1. With results for `tranquillity` shown, click the first result link. Expected: `location.hash` becomes `#book4-3` (or the first matching entry), the page scrolls, and `#search-panel` is **still visible** (`!document.getElementById('search-panel').hidden`).
2. Press `Escape` (`computer` key `Escape`). Expected: panel hidden, `document.activeElement.id === 'search-toggle'`, and the input still holds `tranquillity` (Escape must not clear it).
3. Press `cmd+k` (or `ctrl+k`). Expected: panel open again, input focused with the text selected.
4. Click somewhere in the page body far from the panel (`computer` left_click on body text). Expected: panel hidden.

**Step 5: Layout**

1. `resize_window` preset `mobile`, reload, open the panel, type `logos`. Expected: no horizontal scroll (`document.documentElement.scrollWidth <= window.innerWidth`), panel visible and scrollable. Check the icon does not sit on top of the `h1` text in a way that hides it — if it does, add `@media (max-width: 40em) { header { padding-right: 3.5rem; } }` to the CSS and re-check.
2. `resize_window` preset `desktop`, `colorScheme: "dark"`. Reload, open, type `Verus`. Expected: `getComputedStyle(document.getElementById('search-panel')).backgroundColor` matches the body background, text readable (read_page shows the results).
3. Reset `colorScheme: "light"` and preset `desktop` when done.

**Step 6: Console**

`read_console_messages` with `onlyErrors: true`. Expected: no errors from `search.js`.

**Step 7: Fix anything found, re-run unit tests, then commit**

```bash
node --test tools/meditations-search/test/*.test.mjs
git add meditations/search.js meditations/index.html
git commit -m "fix(meditations): search polish from browser verification

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(Skip the commit if nothing changed. Do **not** `git add` `beta.html` or `seneca/letter-67.html`; they are unrelated pending changes.)

---

### Task 7: Docs

**Files:**
- Create: `tools/meditations-search/README.md`
- Modify: `docs/plans/2026-09-16-meditations-search-design.md` (Status line, and note the external-module deviation)

**Step 1: Write the README**

```markdown
# Meditations search (Books 1–12 only)

Client-side search for `meditations/index.html`. The module lives at `meditations/search.js`
and is loaded with `<script type="module" src="search.js">`. It indexes only
`<section id="book1">` … `<section id="book12">`; Chronology, Introduction, Notes and the
Index of Persons are never searched.

- Trigger: top-right magnifier icon, or Cmd/Ctrl+K. Escape closes.
- Results: entry number (link) + snippet with the hit in `<mark>`; the panel stays open after a click.
- Entry markers: Book 1 uses `<h3 id="book1-N">`; Books 2–12 use `<strong id="bookN-M">`.

## Tests

    node --test tools/meditations-search/test/*.test.mjs

Module scripts are fetched with CORS, so the page must be served over HTTP (`python3 -m http.server` from the repo root); opening `index.html` via `file://` will not load the search.

`search.test.mjs` covers the pure helpers; `markup.test.mjs` guards the page-markup
assumptions (12 sections, 17 + 482 = 499 entry markers, module script present).
```

**Step 2: Update the design doc**

Change `- **Status:** Approved (brainstorming complete; implementation plan to follow)` to `- **Status:** Implemented 2026-09-16 (see [implementation plan](2026-09-16-meditations-search-implementation.md))` and add one line under section 1's table: `Note: shipped as an external module \`meditations/search.js\` (deferred module script) instead of inline JS, for testability. CSS remains inline.`

**Step 3: Commit**

```bash
git add tools/meditations-search/README.md docs/plans/2026-09-16-meditations-search-design.md docs/plans/2026-09-16-meditations-search-implementation.md
git commit -m "docs(meditations): search README and design status

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Done criteria

- `node --test tools/meditations-search/test/*.test.mjs` → all tests pass, 0 fail (19 at the time of writing).
- In the browser: index has 499 entries (including the 11 lettered sub-entries); `Hays`, `Loeb`, `Haines`, `Farquharson` return "No entries match"; `4.3` returns exactly one; Escape/Cmd-K/outside-click behave as in Task 6; panel stays open after clicking a result; no console errors; mobile and dark mode fine.
- Nothing outside `meditations/`, `tools/meditations-search/`, and `docs/plans/` is touched. `beta.html` and `seneca/letter-67.html` remain uncommitted as they were.
