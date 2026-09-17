# Agent Surfaces Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose the 499 entries of the *Meditations* to AI agents as a `search_meditations` tool on both agent surfaces, modernise those surfaces to the July–September 2026 specs, and close three discovery gaps.

**Architecture:** A generated `meditations/entries.json` is the shared corpus. It is produced by a Node scanner that replaces only the DOM-walking step of `meditations/search.js` and then hands off to that module's own `groupEntries()`, so labels, quote folding and whitespace rules stay single-source. The HTTP MCP server reads the corpus over `fetch`; the browser tool reuses the in-page index and needs no corpus at all. Both register the same tool name and input schema.

**Tech Stack:** Plain ES modules. Node 24 with the built-in `node:test` runner (repo convention: `node --test tools/<x>/test/*.test.mjs`). No dependencies, no `package.json`. Cloudflare Pages Functions for `/mcp`. Local preview via `python3 -m http.server`.

**Design doc:** [2026-09-17-agent-surfaces-design.md](2026-09-17-agent-surfaces-design.md).

**Branch:** `agent-surfaces` (already created; the design doc is its first commit).

---

## Facts you need before Task 1

Read these; they are the non-obvious parts of the codebase.

- **No `package.json` and no dependencies anywhere.** Do not add either. Node 24 imports a bare `.js`/`.mjs` ES module without one (already proven by `meditations/search.js`).
- **`meditations/search.js` is importable from Node.** `normalizeText`, `groupEntries`, `findMatches`, `statusText` and `snippet` touch no DOM. The only top-level DOM access is the last line, guarded by `if (typeof document !== 'undefined')`. **Import it; never reimplement it.**
- **`groupEntries()` is the seam.** It consumes `[{ marker, text }]` in document order, where `marker` is `'book4-3'` or `null`, and returns `[{ id, label, text, lower }]`. A Node scanner only has to produce that input array.
- **Entry markers.** Book 1: `<h3 id="book1-N"><a href="#book1-N" title="…">&#167;</a> 1.N Title <sup><a href="#x">i</a></sup></h3>` followed by `<p>` siblings (17 entries). Books 2–12: `<p><a href="#bookN-M" class="return" title="…">&#167;</a> <strong id="bookN-M">N.M</strong> text…</p>` followed by continuation `<p>`/`<ul>`/`<blockquote>` siblings (482 entries, 11 with a letter suffix such as `book4-49a`). **Total 499.**
- **Text excluded from the index:** `<sup>` footnote markers and `<a class="return">` § links. `<mark>` is kept (it wraps ordinary body text). `<mark title="…">` tooltips are attribute text, so `textContent` never sees them — the scanner must not emit them either.
- **HTML entities in the Books, exhaustively:** `&mdash;` (616), `&#167;` (499), `&hellip;` (108), `&#35;` (12), `&lt;` (5), `&gt;` (5). Site-wide also `&ndash;` and `&#8984;`. **There is no `&amp;`.** The browser decodes these via `textContent`; the scanner must decode them explicitly or the corpus will differ from what readers search.
- **`<section id="notes">` and `<section id="persons">` follow Book 12 inside `<main>`.** The scanner must stop at Book 12; only `/^book\d+$/` sections are indexed.
- **Probe words (verified by grep).** Inside the Books: `Verus`, `tranquillity`, `logos`, `Antoninus`. **Outside** the Books only: `Hays`, `Loeb`, `Haines`, `Farquharson` — these must return zero matches, which is how you know the scanner did not leak the Introduction or Notes in.
- **`.well-known/ai-catalog.json` is generated.** `tools/ards/build.mjs` reads `.well-known/mcp/server-card.json` and writes the catalog plus `did.json`. Never hand-edit the catalog; its `capabilities` array is `serverCard.tools.map(t => t.name)`.
- **`functions/mcp.js`** is a Cloudflare Pages Function at `https://vreeman.com/mcp`. Stateless JSON-RPC 2.0, `application/json` only, no SSE, no sessions, no auth. Its `dispatch()` is currently module-private and synchronous.

Run all tests at any time with:

```bash
node --test tools/meditations-search/test/*.test.mjs tools/mcp/test/*.test.mjs tools/agent-skills/test/*.test.mjs
```

---

## Task 1: HTML → items scanner

Turns the raw Book markup into the `[{ marker, text }]` array `groupEntries()` expects. This is the only genuinely new parsing code in the project; everything downstream is reused.

**Files:**
- Create: `tools/meditations-search/lib/scan-html.mjs`
- Test: `tools/meditations-search/test/scan-html.test.mjs`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, stripTags, scanBooks } from '../lib/scan-html.mjs';

test('decodeEntities handles every entity the Books use', () => {
  assert.equal(decodeEntities('a&mdash;b'), 'a—b');
  assert.equal(decodeEntities('&#167; 2.1'), '§ 2.1');
  assert.equal(decodeEntities('wait&hellip;'), 'wait…');
  assert.equal(decodeEntities('&#35;'), '#');
  assert.equal(decodeEntities('&lt;i&gt;'), '<i>');
  assert.equal(decodeEntities('&ndash;'), '–');
});

test('decodeEntities throws on an entity it does not know', () => {
  // A silent passthrough would ship a literal "&amp;" into the agent corpus.
  assert.throws(() => decodeEntities('Tom &amp; Jerry'), /unknown entity/i);
});

test('stripTags drops sup and return links, keeps mark text', () => {
  const html = '<a href="#book2-1" class="return" title="x">&#167;</a> ' +
               '<strong id="book2-1">2.1</strong> <mark title="tip">Keep me</mark>' +
               ' and me<sup><a href="#n">i</a></sup>.';
  assert.equal(stripTags(html), '§ 2.1 Keep me and me.'.replace('§ ', ''));
});

test('stripTags pads block boundaries so words do not fuse', () => {
  assert.equal(stripTags('<p>world.</p><p>My</p>'), ' world.  My ');
});

test('scanBooks finds a Book 1 h3 marker', () => {
  const html = `<main><section id="book1">
    <h2>Book 1</h2>
    <h3 id="book1-1"><a href="#book1-1">&#167;</a> 1.1 My grandfather Verus <sup><a href="#v">i</a></sup></h3>
    <p>Character and self-control.</p>
  </section></main>`;
  assert.deepEqual(scanBooks(html), [
    { marker: 'book1-1', text: '1.1 My grandfather Verus' },
    { marker: null, text: 'Character and self-control.' },
  ]);
});

test('scanBooks finds a Books 2-12 strong marker and a lettered sub-entry', () => {
  const html = `<main><section id="book4">
    <h2>Book 4</h2>
    <p><a href="#book4-49" class="return">&#167;</a> <strong id="book4-49">4.49</strong> Be like the rock.</p>
    <p><a href="#book4-49a" class="return">&#167;</a> <strong id="book4-49a">4.49a</strong> Or say instead.</p>
  </section></main>`;
  const items = scanBooks(html);
  assert.deepEqual(items.map(i => i.marker), ['book4-49', 'book4-49a']);
});

test('scanBooks ignores sections that are not Books', () => {
  const html = `<main>
    <section id="introduction"><p>By Gregory Hays.</p></section>
    <section id="book1"><h2>Book 1</h2><h3 id="book1-1">1.1 Verus</h3></section>
    <section id="notes"><p>Loeb edition.</p></section>
  </main>`;
  assert.deepEqual(scanBooks(html).map(i => i.marker), ['book1-1']);
});
```

**Step 2: Run it and watch it fail**

```bash
node --test tools/meditations-search/test/scan-html.test.mjs
```

Expected: FAIL — `Cannot find module '../lib/scan-html.mjs'`.

**Step 3: Implement**

```js
// Node-side counterpart to the DOM walk in meditations/search.js. Produces the
// [{ marker, text }] array groupEntries() consumes, so every rule downstream of that
// — labels, quote folding, whitespace — comes from the shipped module, not from here.

// Exhaustive for the Books as of 2026-09-17; see the plan's "Facts you need".
// Unknown entities throw rather than pass through: a literal "&amp;" in the corpus
// would be invisible in review and wrong in every agent answer.
const ENTITIES = {
  '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
  '&#167;': '§', '&#35;': '#', '&#8984;': '⌘',
  '&lt;': '<', '&gt;': '>',
};

export function decodeEntities(s) {
  return String(s).replace(/&[a-zA-Z][a-zA-Z0-9]*;|&#\d+;/g, (m) => {
    if (m in ENTITIES) return ENTITIES[m];
    throw new Error(`scan-html: unknown entity ${m} — add it to ENTITIES and check search.js agrees`);
  });
}

const STRIP_ELEMENTS = /<sup\b[^>]*>[\s\S]*?<\/sup>|<a\b[^>]*class="return"[^>]*>[\s\S]*?<\/a>/gi;
const PAD_TAGS = /<\/?(?:br|li|p)\b[^>]*>/gi;

export function stripTags(html) {
  return decodeEntities(
    html.replace(STRIP_ELEMENTS, '')
        .replace(PAD_TAGS, ' $& ')
        .replace(/<[^>]+>/g, '')
  );
}

const SECTION = /<section id="(book\d+)">([\s\S]*?)<\/section>/g;
// Direct children of a Book section: h2 (skipped), h3 markers, and p/ul/blockquote bodies.
const CHILD = /<(h2|h3|p|ul|ol|blockquote)\b[^>]*>[\s\S]*?<\/\1>/g;
const H3_ID = /^<h3 id="(book\d+-\d+[a-z]?)"/;
const STRONG_ID = /<strong id="(book\d+-\d+[a-z]?)"/;

export function scanBooks(html) {
  const items = [];
  for (const [, , body] of html.matchAll(SECTION)) {
    for (const [child, tag] of body.matchAll(CHILD)) {
      if (tag === 'h2') continue;
      const h3 = H3_ID.exec(child);
      const strong = h3 ? null : STRONG_ID.exec(child);
      items.push({
        marker: h3 ? h3[1] : strong ? strong[1] : null,
        text: stripTags(child).replace(/\s+/g, ' ').trim(),
      });
    }
  }
  return items;
}
```

> **Note on `stripTags` and the first test.** Whitespace is collapsed by `normalizeText()` downstream, so the exact spacing `stripTags` emits does not matter — only that block boundaries never fuse two words. Write the assertions against what the implementation actually produces after you have seen it run; do not contort the implementation to match a guessed string.

**Step 4: Run it and watch it pass**

```bash
node --test tools/meditations-search/test/scan-html.test.mjs
```

Expected: PASS, 6 tests.

**Step 5: Commit**

```bash
git add tools/meditations-search/lib/scan-html.mjs tools/meditations-search/test/scan-html.test.mjs
git commit -m "Add Node-side HTML scanner for the Meditations Books"
```

---

## Task 2: Generate `meditations/entries.json`

**Files:**
- Create: `tools/meditations-search/build-index.mjs`
- Create: `meditations/entries.json` (generated output — commit it)
- Test: `tools/meditations-search/test/index.test.mjs`

**Step 1: Write the failing test**

This is the test that makes the sync obligation enforced rather than remembered.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEntries } from '../build-index.mjs';
import { findMatches } from '../../../meditations/search.js';

const html = readFileSync(new URL('../../../meditations/index.html', import.meta.url), 'utf8');
const shipped = JSON.parse(readFileSync(new URL('../../../meditations/entries.json', import.meta.url), 'utf8'));

test('the corpus has all 499 entries', () => {
  assert.equal(shipped.length, 499);
});

test('the shipped corpus is what the generator produces right now', () => {
  // Fails the moment meditations/index.html changes without a rebuild.
  assert.deepEqual(shipped, buildEntries(html));
});

test('labels match the markers in the HTML, in document order', () => {
  const markers = [...html.matchAll(/<(?:h3|strong) id="(book\d+-\d+[a-z]?)"/g)].map(m => m[1]);
  assert.deepEqual(shipped.map(e => e.id), markers);
});

test('no entity survived into the corpus', () => {
  const offender = shipped.find(e => /&[a-zA-Z][a-zA-Z0-9]*;|&#\d+;/.test(e.text));
  assert.equal(offender, undefined, `entity left in ${offender?.id}`);
});

test('the leading entry number is stripped from the text', () => {
  const e = shipped.find(x => x.id === 'book2-1');
  assert.ok(!e.text.startsWith('2.1'), `text still starts with its label: ${e.text.slice(0, 20)}`);
});

test('words inside the Books are findable', () => {
  for (const word of ['Verus', 'tranquillity', 'logos', 'Antoninus']) {
    assert.ok(findMatches(shipped, word).matches.length > 0, `${word} should be in the Books`);
  }
});

test('words outside the Books are absent', () => {
  // Introduction, Notes and Index of Persons must never have leaked in.
  for (const word of ['Hays', 'Loeb', 'Haines', 'Farquharson']) {
    assert.equal(findMatches(shipped, word).matches.length, 0, `${word} is not in the Books`);
  }
});

test('an entry number matches its entry directly', () => {
  const { matches } = findMatches(shipped, '4.3');
  assert.equal(matches[0].id, 'book4-3');
});
```

**Step 2: Run it and watch it fail**

```bash
node --test tools/meditations-search/test/index.test.mjs
```

Expected: FAIL — `Cannot find module '../build-index.mjs'`.

**Step 3: Implement**

```js
// Generates meditations/entries.json — the corpus the MCP server searches, and a
// machine-readable edition of the Books in its own right.
//
//   node tools/meditations-search/build-index.mjs
//
// Grouping, labels and quote folding come from meditations/search.js so the corpus
// cannot drift from what readers search in the browser.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanBooks } from './lib/scan-html.mjs';
import { groupEntries } from '../../meditations/search.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SOURCE_PATH = 'meditations/index.html';
export const OUTPUT_PATH = 'meditations/entries.json';
export const EXPECTED_ENTRIES = 499;

export function buildEntries(html) {
  // `lower` is derivable from `text`; shipping it would double the file for nothing.
  return groupEntries(scanBooks(html)).map(({ id, label, text }) => ({ id, label, text }));
}

function main() {
  const html = fs.readFileSync(path.join(REPO_ROOT, SOURCE_PATH), 'utf8');
  const entries = buildEntries(html);
  if (entries.length !== EXPECTED_ENTRIES) {
    console.error(`ERROR expected ${EXPECTED_ENTRIES} entries, scanned ${entries.length} — check the Book markup.`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(REPO_ROOT, OUTPUT_PATH), JSON.stringify(entries) + '\n');
  const kb = Math.round(fs.statSync(path.join(REPO_ROOT, OUTPUT_PATH)).size / 1024);
  console.log(`OK  ${entries.length} entries → ${OUTPUT_PATH} (${kb} KB)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
```

**Step 4: Generate the corpus, then run the tests**

```bash
node tools/meditations-search/build-index.mjs
node --test tools/meditations-search/test/*.test.mjs
```

Expected: `OK  499 entries → meditations/entries.json (…KB)`, then all tests PASS.

If the count is wrong, fix `scan-html.mjs` — **do not** change `EXPECTED_ENTRIES`. `markup.test.mjs` independently asserts 499 against the raw HTML; the two must agree.

**Step 5: Add the cache header**

Modify `_headers`, beside the other generated artifacts:

```
# Meditations corpus — the MCP server's search index, and a machine-readable
# edition of Books 1–12. Open CORS so browser agents can fetch it too.
/meditations/entries.json
    Content-Type: application/json
    Access-Control-Allow-Origin: *
    Cache-Control: public, max-age=3600
```

**Step 6: Commit**

```bash
git add tools/meditations-search/build-index.mjs tools/meditations-search/test/index.test.mjs meditations/entries.json _headers
git commit -m "Generate meditations/entries.json as the shared search corpus"
```

---

## Task 3: `search_meditations` on the MCP server

`dispatch()` must become async and injectable before a tool that fetches a corpus can be tested at all. Do that first, in the same task, with no behaviour change.

**Files:**
- Modify: `functions/mcp.js`
- Create: `tools/mcp/test/dispatch.test.mjs`
- Create: `tools/mcp/README.md`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../../../functions/mcp.js';

const CORPUS = [
  { id: 'book4-3', label: '4.3', text: 'People look for retreats for themselves, in the country, by the coast.' },
  { id: 'book2-1', label: '2.1', text: 'When you wake up in the morning, tell yourself.' },
];
const deps = { loadEntries: async () => CORPUS };
const call = (name, args) =>
  dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, deps);

test('tools/list offers both tools', async () => {
  const res = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, deps);
  assert.deepEqual(res.result.tools.map(t => t.name).sort(), ['search_content', 'search_meditations']);
});

test('search_meditations returns a deep link per hit', async () => {
  const res = await call('search_meditations', { query: 'retreats' });
  assert.equal(res.result.isError, false);
  assert.match(res.result.content[0].text, /4\.3/);
  assert.match(res.result.content[0].text, /https:\/\/vreeman\.com\/meditations\/#book4-3/);
});

test('search_meditations finds an entry by its number', async () => {
  const res = await call('search_meditations', { query: '2.1' });
  assert.match(res.result.content[0].text, /#book2-1/);
});

test('search_meditations reports no matches without erroring', async () => {
  const res = await call('search_meditations', { query: 'Farquharson' });
  assert.equal(res.result.isError, false);
  assert.match(res.result.content[0].text, /No entries match/);
});

test('search_meditations rejects an empty query', async () => {
  const res = await call('search_meditations', { query: '  ' });
  assert.equal(res.result.isError, true);
});

test('search_content still works', async () => {
  const res = await call('search_content', { query: 'utm' });
  assert.match(res.result.content[0].text, /vreeman\.com\/utm/);
});

test('an unknown tool is a JSON-RPC error', async () => {
  const res = await call('nope', { query: 'x' });
  assert.equal(res.error.code, -32602);
});
```

**Step 2: Run it and watch it fail**

```bash
node --test tools/mcp/test/dispatch.test.mjs
```

Expected: FAIL — `dispatch` is not exported.

**Step 3: Implement in `functions/mcp.js`**

Three changes.

**3a.** Export `dispatch`, make it `async`, and give it an injectable corpus loader:

```js
// The corpus is generated by tools/meditations-search/build-index.mjs. Fetched once per
// isolate and cached in module scope; edge-cached for an hour by _headers.
const ENTRIES_URL = "https://vreeman.com/meditations/entries.json";
let entriesPromise = null;
const defaultLoadEntries = () => (entriesPromise ??= fetch(ENTRIES_URL).then((r) => r.json()));

export async function dispatch(msg, deps = {}) {
  const loadEntries = deps.loadEntries || defaultLoadEntries;
  // …existing switch, with the tools/call branch awaiting where needed
}
```

**3b.** Add the tool definition and its search, mirroring the WebMCP tool name exactly:

```js
const MEDITATIONS_TOOL = {
  name: "search_meditations",
  title: "Search the Meditations",
  description:
    "Search the 499 entries of Marcus Aurelius' Meditations (Books 1–12, Gregory Hays translation) " +
    "and return the matching entries with a snippet and a deep link. Books only — the Introduction, " +
    "Notes and Index of Persons are not searched.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "A phrase, e.g. 'retreats for themselves', or an entry number such as '4.3'.",
      },
    },
    required: ["query"],
  },
  annotations: { readOnlyHint: true },
};

const MAX_RESULTS = 20;

// findMatches/snippet/statusText are duplicated here rather than imported: a Pages Function
// cannot import from meditations/search.js at deploy time. tools/mcp/test/dispatch.test.mjs
// and tools/meditations-search/test/search.test.mjs pin both copies to the same behaviour.
function searchMeditations(entries, query) {
  const { query: q, matches } = findMatches(entries, query);
  if (!matches.length) return `No entries match "${q}".`;
  const shown = matches.slice(0, MAX_RESULTS);
  const head = `${statusText(matches.length)} "${q}"` +
    (matches.length > MAX_RESULTS ? ` (showing the first ${MAX_RESULTS})` : "") + ":";
  const lines = shown.map((e) => {
    const s = snippet(e, q);
    const text = (s.leading ? "…" : "") + s.before + s.hit + s.after + (s.trailing ? "…" : "");
    return `• ${e.label} — ${text} — https://vreeman.com/meditations/#${e.id}`;
  });
  return [head, ...lines].join("\n");
}
```

Copy `findMatches`, `snippet`, `statusText`, `normalizeText`, `foldQuotes`, `wordEnd`, `MIN_QUERY` and `SNIPPET_RADIUS` verbatim from `meditations/search.js` into `functions/mcp.js`. `groupEntries` is **not** needed — `entries.json` is already grouped — but `findMatches` reads `e.lower`, which the corpus omits, so rebuild it on load:

```js
const withLower = (entries) => entries.map((e) => ({ ...e, lower: foldQuotes(e.text).toLowerCase() }));
```

**3c.** Route the tool in `tools/call`, and add it to `tools/list`:

```js
case "tools/list":
  return ok(id, { tools: [SEARCH_TOOL, MEDITATIONS_TOOL] });
```

Keep the existing empty-query guard and apply it to both tools.

**Step 4: Run it and watch it pass**

```bash
node --test tools/mcp/test/dispatch.test.mjs
```

Expected: PASS, 7 tests.

**Step 5: Write `tools/mcp/README.md`**

Cover: what the endpoint is, the two tools, why `findMatches` is duplicated and which tests pin the copies together, and how to run the tests. Follow the tone of `tools/meditations-search/README.md`.

**Step 6: Commit**

```bash
git add functions/mcp.js tools/mcp/
git commit -m "Add search_meditations to the MCP server"
```

---

## Task 4: MCP 2026-07-28

MCP's 2026-07-28 revision removes the `initialize` handshake. The endpoint must serve both eras, because older clients open with a handshake and cannot fall forward when it is refused.

**Files:**
- Modify: `functions/mcp.js`
- Modify: `tools/mcp/test/dispatch.test.mjs`
- Modify: `.well-known/mcp/server-card.json`

**Step 1: Write the failing tests**

```js
test('server/discover answers without a handshake', async () => {
  const res = await dispatch({ jsonrpc: '2.0', id: 1, method: 'server/discover' }, deps);
  assert.equal(res.result.serverInfo.name, 'com.vreeman/site-search');
  assert.ok(res.result.capabilities.tools);
});

test('a request may declare its own protocol version', async () => {
  const res = await dispatch(
    { jsonrpc: '2.0', id: 1, method: 'server/discover', params: { protocolVersion: '2026-07-28' } }, deps);
  assert.equal(res.result.protocolVersion, '2026-07-28');
});

test('legacy initialize still works', async () => {
  const res = await dispatch(
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, deps);
  assert.equal(res.result.protocolVersion, '2025-06-18');
});

test('an unknown version falls back to the latest', async () => {
  const res = await dispatch(
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, deps);
  assert.equal(res.result.protocolVersion, '2026-07-28');
});
```

**Step 2: Run and watch fail**

```bash
node --test tools/mcp/test/dispatch.test.mjs
```

Expected: FAIL — `Method not found: server/discover`.

**Step 3: Implement**

```js
const SUPPORTED_PROTOCOL_VERSIONS = ["2026-07-28", "2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_PROTOCOL_VERSION = "2026-07-28";
// MCP 2026-07-28 removed the handshake. We keep `initialize` answering for older clients
// and announce our own window, because the standard moved past it without scheduling removal.
const LEGACY_INITIALIZE_SUNSET = "Wed, 30 Sep 2026 00:00:00 GMT";
```

Add a `server/discover` case returning the same shape as `initialize`, and have `initialize` delegate to it. Mark the response so the HTTP wrapper can set headers:

```js
case "initialize": {
  const res = discover(id, params);
  res._legacy = true;   // stripped before serialising; see onRequestPost
  return res;
}
```

In `onRequestPost`, after `const res = await dispatch(msg)`:

```js
const legacy = res._legacy;
delete res._legacy;
return json(res, 200, legacy ? {
  deprecation: "true",
  sunset: LEGACY_INITIALIZE_SUNSET,
  link: '<https://modelcontextprotocol.io/specification/2026-07-28>; rel="deprecation"',
} : {});
```

Widen `json()` to take extra headers.

**Step 4: Run and watch pass**

```bash
node --test tools/mcp/test/dispatch.test.mjs
```

Expected: PASS, 11 tests.

**Step 5: Update the server card**

In `.well-known/mcp/server-card.json`, add `"2026-07-28"` to the front of both `supportedProtocolVersions` arrays, set `"protocolVersion": "2026-07-28"`, bump `"version"` to `"1.1.0"` (both at the top level and in `serverInfo`), and add the `search_meditations` tool object to `tools` — copy `MEDITATIONS_TOOL` verbatim minus `annotations`.

**Step 6: Commit**

```bash
git add functions/mcp.js tools/mcp/test/dispatch.test.mjs .well-known/mcp/server-card.json
git commit -m "Serve MCP 2026-07-28 alongside the legacy handshake"
```

---

## Task 5: Regenerate the ARD catalog

**Files:**
- Modify: `tools/ards/build-catalog.mjs` (representative queries only)
- Regenerate: `.well-known/ai-catalog.json`

**Step 1:** Add two Meditations-shaped queries to the MCP entry's `representativeQueries`, so the new tool is visible in what the catalog advertises:

```js
representativeQueries: [
  'seneca letters on the fear of death',
  'epictetus dichotomy of control',
  'marcus aurelius on retreats into yourself',
  'meditations entry 4.3',
  'GA4 UTM campaign URL builder',
],
```

**Step 2: Regenerate and verify**

```bash
node tools/ards/build.mjs
node --test tools/ards/test/*.test.mjs
git diff --stat .well-known/ai-catalog.json
```

Expected: the catalog's `capabilities` array is now `["search_content", "search_meditations"]` and `version` is `1.1.0`, both picked up from the server card with no hand-editing. The OKF entry must be **unchanged** — its v0.2 migration is explicitly out of scope.

**Step 3: Commit**

```bash
git add tools/ards/build-catalog.mjs .well-known/ai-catalog.json
git commit -m "Regenerate the ARD catalog with search_meditations"
```

---

## Task 6: WebMCP on the Meditations page

The same tool name and schema as Task 3, but in the browser it needs no corpus — `search.js` has already built the index.

**Files:**
- Create: `meditations/webmcp.js`
- Modify: `meditations/index.html` (a small inline guard near `<script type="module" src="search.js">`, around line 3391)
- Modify: `tools/meditations-search/test/markup.test.mjs`

**Step 1: Write the failing markup test**

```js
test('the WebMCP bundle is loaded only when the API exists', () => {
  // Guard the LOAD, not just the registration: a visitor whose browser has no
  // WebMCP must download nothing at all, not a script that returns early.
  const m = /<script>\s*if\s*\((document\.modelContext|navigator\.modelContext)[\s\S]{0,400}?webmcp\.js[\s\S]*?<\/script>/.exec(html);
  assert.ok(m, 'an inline guard injects webmcp.js');
  assert.match(m[0], /document\.modelContext/, 'checks the current surface');
  assert.match(m[0], /navigator\.modelContext/, 'and the earlier draft');
  assert.ok(!/<script type="module" src="webmcp\.js">/.test(html), 'never loaded unconditionally');
});
```

**Step 2: Run and watch fail**

```bash
node --test tools/meditations-search/test/markup.test.mjs
```

**Step 3: Create `meditations/webmcp.js`**

```js
// WebMCP — exposes the Books search to an in-browser agent.
// Spec: https://webmachinelearning.github.io/webmcp/
// Loaded only by the inline guard in index.html, which checks for the API first.
// The tool name and inputSchema match search_meditations on https://vreeman.com/mcp,
// so an agent that knows one recognises the other.

import { buildIndex, findMatches, snippet, statusText } from './search.js';

const MAX_RESULTS = 20;
let index = null;

const tool = {
  name: 'search_meditations',
  description:
    "Search the 499 entries of Marcus Aurelius' Meditations (Books 1–12, Gregory Hays translation) " +
    'and return the matching entries with a snippet and a deep link.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: "A phrase, or an entry number such as '4.3'." },
    },
    required: ['query'],
  },
  annotations: { readOnlyHint: true },
  async execute(input) {
    index ??= buildIndex(document);           // the page has usually built this already
    const { query, matches } = findMatches(index, (input && input.query) || '');
    if (!matches.length) return { content: [{ type: 'text', text: `No entries match "${query}".` }] };
    const lines = matches.slice(0, MAX_RESULTS).map((e) => {
      const s = snippet(e, query);
      const text = (s.leading ? '…' : '') + s.before + s.hit + s.after + (s.trailing ? '…' : '');
      return `• ${e.label} — ${text} — https://vreeman.com/meditations/#${e.id}`;
    });
    return { content: [{ type: 'text', text: [`${statusText(matches.length)} "${query}":`, ...lines].join('\n') }] };
  },
};

// Current surface first, then the earlier draft. No stand-in here when neither exists:
// unlike the homepage (see Task 7), this page is not the surface isitagentready.com scans.
const mc = document.modelContext || navigator.modelContext;
if (mc) {
  if (typeof mc.registerTool === 'function') {
    try { mc.registerTool(tool); } catch {}
  } else if (typeof mc.provideContext === 'function') {
    try { mc.provideContext({ tools: [tool] }); } catch {}
  }
}
```

**Step 4: Add the inline guard to `meditations/index.html`**

Directly after `<script type="module" src="search.js"></script>`:

```html
<script>
// Feature-detect before downloading, not inside the bundle: a visitor whose browser
// has no WebMCP should fetch nothing. Guard the load, then guard the call.
if (document.modelContext || navigator.modelContext) {
  var s = document.createElement('script');
  s.type = 'module';
  s.src = 'webmcp.js';
  document.head.appendChild(s);
}
</script>
```

**Step 5: Run the tests**

```bash
node --test tools/meditations-search/test/*.test.mjs
```

Expected: PASS.

**Step 6: Verify in the browser**

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://localhost:8765/meditations/`, and in the console confirm **no request for `webmcp.js`** appears in the network panel (no browser here implements the API). Then force it:

```js
navigator.modelContext = { tools: [], registerTool(t) { this.tools.push(t); return { name: t.name }; } };
location.reload();
// after load:
await navigator.modelContext.tools[0].execute({ query: 'retreats' });
```

Expected: a result string containing `4.3` and `#book4-3`.

**Step 7: Commit**

```bash
git add meditations/webmcp.js meditations/index.html tools/meditations-search/test/markup.test.mjs
git commit -m "Register search_meditations as a WebMCP tool on the Meditations page"
```

---

## Task 7: Homepage WebMCP — one-line detection fix only

> **READ THIS BEFORE TOUCHING `index.html`.** The obvious cleanups here are both traps.
>
> **Do NOT remove the `navigator.modelContext` shim.** **Do NOT move the inline block into an
> external file or put it behind a load guard.** isitagentready.com evaluates
> `checks.discovery.webMcp` at *runtime*, in a headless browser with no native WebMCP API, and
> reports "No tools registered via `navigator.modelContext`". The shim is what makes the tool
> detectable there; the check was confirmed passing live on 2026-06-02 (commit `a0ac52c`).
> Removing the shim, or guarding the load, each independently breaks a green check.
>
> The Meditations page in Task 6 is not the scanned surface, which is why it follows the spec's
> guard-the-load pattern and this page does not. See design §5.2 for the full reasoning.

**Files:**
- Modify: `index.html` (the WebMCP IIFE, the detection tail at lines ~831–848)

**Step 1:** Change only the *first* line of the detection tail, so a browser that really ships the
API wins over the shim. Everything else in the block stays exactly as it is.

```js
      // Current surface first, then the earlier draft. When neither exists, fall through to the
      // shim below: isitagentready.com's runtime check looks for tools on navigator.modelContext
      // in a browser that implements neither, and a missing shim reads as "no tools registered".
      var native = document.modelContext || navigator.modelContext;
      if (native) {
        register(native);
      } else {
        // …existing shim, unchanged…
      }
```

**Step 2: Verify the shim still runs**

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Load `http://localhost:8765/`, then in the console:

```js
navigator.modelContext.tools.map(t => t.name)   // ["search_content"]
```

Expected: the array is populated **without** you having installed anything first — that is the
behaviour the scanner depends on. If it is empty, the shim is not running and the check will fail.

**Step 3: Re-run the scanner after deploy**

```bash
curl -s -X POST https://isitagentready.com/api/scan \
  -H 'content-type: application/json' -d '{"url":"https://vreeman.com"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(JSON.stringify(j.checks.discovery.webMcp,null,2))})'
```

Expected: `status: "pass"`, evidence naming one tool found via `navigator.modelContext`. If it
regressed, revert this task — the detection nicety is not worth the check.

**Step 4: Commit**

```bash
git add index.html
git commit -m "Prefer document.modelContext on the homepage, keeping the detection shim"
```

---

## Task 8: Advertise `/llms.txt`

v2's one hard addition. Without it, the file is found only by an agent that already guessed the path — the exact failure v2 set out to fix.

**Files:**
- Modify: `_headers`
- Modify: `index.html`, `meditations/index.html`, `discourses/index.html`, `seneca/index.html`, `stockdale/index.html`

**Step 1:** Extend the site-wide `Link` header in `_headers` (one line; append to the existing comma-separated list):

```
    Link: <https://gtm.vreeman.com>; rel="preconnect"; crossorigin, <https://gtm.vreeman.com>; rel="dns-prefetch", <https://vreeman.com/schema.json>; rel="alternate"; type="application/ld+json", </llms.txt>; rel="describedby"; type="text/markdown", </.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"
```

**Step 2:** Add to each page's head, beside the existing `rel="ai-catalog"` line where there is one:

```html
<link rel="describedby" href="https://vreeman.com/llms.txt" type="text/markdown">
```

Both header and element, deliberately: the header reaches agents that never parse HTML, the element reaches those that only parse HTML.

**Step 3: Verify**

```bash
grep -c 'rel="describedby"' index.html meditations/index.html discourses/index.html seneca/index.html stockdale/index.html
```

Expected: `1` for each.

**Step 4: Commit**

```bash
git add _headers index.html meditations/index.html discourses/index.html seneca/index.html stockdale/index.html
git commit -m "Advertise /llms.txt with rel=describedby (llms.txt v2)"
```

---

## Task 9: Agent Skills discovery

**Files:**
- Create: `.well-known/agent-skills/vreeman-stoic-library/SKILL.md`
- Create: `.well-known/agent-skills/index.json` (generated)
- Create: `tools/agent-skills/build.mjs`
- Test: `tools/agent-skills/test/digest.test.mjs`
- Modify: `_headers`

The digest drifting from the file is the spec's first-listed mistake, so generate the index rather than hand-writing it.

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildIndex } from '../build.mjs';

const index = JSON.parse(readFileSync(new URL('../../../.well-known/agent-skills/index.json', import.meta.url), 'utf8'));

test('the index declares the v0.2.0 schema', () => {
  assert.equal(index.$schema, 'https://schemas.agentskills.io/discovery/0.2.0/schema.json');
});

test('every digest matches the artefact it names', () => {
  for (const skill of index.skills) {
    const bytes = readFileSync(new URL(`../../../.well-known/agent-skills/${skill.name}/SKILL.md`, import.meta.url));
    assert.equal(skill.digest, 'sha256:' + createHash('sha256').update(bytes).digest('hex'), skill.name);
  }
});

test('the shipped index is what the generator produces now', () => {
  assert.deepEqual(index, buildIndex());
});

test('each SKILL.md starts with name and description frontmatter', () => {
  for (const skill of index.skills) {
    const md = readFileSync(new URL(`../../../.well-known/agent-skills/${skill.name}/SKILL.md`, import.meta.url), 'utf8');
    const fm = /^---\n([\s\S]*?)\n---/.exec(md);
    assert.ok(fm, `${skill.name} has frontmatter`);
    assert.match(fm[1], /^name: [a-z][a-z0-9-]{0,63}$/m);
    assert.match(fm[1], /^description: .+/m);
  }
});
```

**Step 2: Run and watch fail.**

**Step 3: Write `SKILL.md`**

Frontmatter `name: vreeman-stoic-library`, and a `description` that front-loads the *when to use this* signal (it is the only thing most agents read — not marketing copy). The body teaches an agent to: query `search_meditations` on `https://vreeman.com/mcp` for entry-level lookups; fetch `https://vreeman.com/meditations/entries.json` for the whole corpus in one request; cite entries as `https://vreeman.com/meditations/#bookN-M`; and read `/llms.txt` for the wider library. Keep it sharp and single-purpose — several small skills beat one omnibus file.

**Step 4: Write `tools/agent-skills/build.mjs`**

Exports `buildIndex()` returning `{ $schema, skills: [{ name, type: 'skill-md', description, url, digest }] }`, reading each `SKILL.md`, taking `description` from its frontmatter and `digest` as `sha256:<hex>` over the raw bytes. `main()` writes `.well-known/agent-skills/index.json`. Follow the shape of `tools/ards/build.mjs`.

**Step 5: Generate and test**

```bash
node tools/agent-skills/build.mjs
node --test tools/agent-skills/test/*.test.mjs
```

**Step 6: Add to `_headers`**

```
/.well-known/agent-skills/index.json
    Content-Type: application/json
    Access-Control-Allow-Origin: *
    Cache-Control: public, max-age=3600
/.well-known/agent-skills/*/SKILL.md
    Content-Type: text/markdown; charset=utf-8
    Access-Control-Allow-Origin: *
```

Serving `SKILL.md` as `text/html` is a listed mistake; the `Link: …rel="agent-skills"` advertisement already went in with Task 8.

**Step 7: Commit**

```bash
git add .well-known/agent-skills/ tools/agent-skills/ _headers
git commit -m "Publish an Agent Skills index for the Stoic library"
```

---

## Task 10: `tdm-reservation: 0`

**Files:** Modify `_headers`.

**Step 1:** In the site-wide `/*` block:

```
    tdm-reservation: 0
```

TDMRep governs whether what a bot fetched may be **mined**, which `robots.txt` does not speak to; under Article 4 of the EU copyright directive a reservation that is not machine-readable does not count at all. `0` declines to reserve — the honest counterpart to this site's CC BY 4.0 licence and its existing `Content-Signal: ai-train=yes`. Do not write `1` unless the licence changes too.

**Step 2: Commit**

```bash
git add _headers
git commit -m "Send tdm-reservation: 0, matching the CC BY 4.0 licence"
```

---

## Task 11: Meditations metadata corrections

**Files:** Modify `meditations/index.html`, `index.html`, `schema.json`.

**Step 1: D1 — make `og:url` canonical.** `meditations/index.html` line ~430:

```html
<meta property="og:url" content="https://vreeman.com/meditations/">
```

The UTM parameters made every share advertise a non-canonical URL, and anything treating `og:url` as the page's identity recorded the tagged one. Campaign attribution for shares belongs in the share link, not in the page's own statement of what it is.

**Step 2: D2 — one `@id` for the `WebSite` node.** Use the absolute `https://vreeman.com/#website` in all three files. Relative `@id`s such as `#website` resolve against the containing page, so today the homepage and `schema.json` describe a *different node* on every URL that uses them.

- `meditations/index.html` line ~1107: `"@id": "https://vreeman.com/"` → `"https://vreeman.com/#website"`
- `index.html` line ~292 and `schema.json`: `"@id": "#website"` → `"https://vreeman.com/#website"`

Check for `isPartOf` / `hasPart` references pointing at the old ids and update them in the same pass:

```bash
grep -n '"@id": "#website"\|"@id": "https://vreeman.com/"\|vreeman.com/#website' index.html meditations/index.html schema.json
```

**Step 3: Verify**

Extract each JSON-LD block and confirm it still parses:

```bash
node -e 'const fs=require("fs");for(const f of ["index.html","meditations/index.html"]){const m=[...fs.readFileSync(f,"utf8").matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];m.forEach((x,i)=>{JSON.parse(x[1]);console.log(f,"block",i,"ok")})}'
node -e 'JSON.parse(require("fs").readFileSync("schema.json","utf8"));console.log("schema.json ok")'
```

Then paste `https://vreeman.com/meditations/` into the Rich Results Test after deploy.

**Step 4: Commit**

```bash
git add meditations/index.html index.html schema.json
git commit -m "Canonical og:url and a single @id for the WebSite node"
```

---

## Task 12: Documentation and final verification

**Files:** Modify `tools/meditations-search/README.md`, `README.md`.

**Step 1:** Add to `tools/meditations-search/README.md` a section covering `entries.json`: what it is, that it is generated, the rebuild command, and that `index.test.mjs` fails if it drifts from the HTML.

**Step 2: Run everything**

```bash
node --test tools/meditations-search/test/*.test.mjs tools/mcp/test/*.test.mjs tools/agent-skills/test/*.test.mjs tools/ards/test/*.test.mjs tools/entitymap/test/*.test.mjs tools/okf/test/*.test.mjs
```

Expected: all PASS, no regressions in `entitymap` or `okf`.

**Step 3: Confirm the generated files are in sync**

```bash
node tools/meditations-search/build-index.mjs
node tools/agent-skills/build.mjs
node tools/ards/build.mjs
git status --short
```

Expected: **no diff** — every generated file already matches its generator. A diff here means something was hand-edited.

**Step 4: Post-deploy checks** (record the results; these need the live site)

```bash
curl -sI https://vreeman.com/ | grep -iE '^(link|tdm-reservation):'
curl -sI https://vreeman.com/.well-known/agent-skills/index.json | grep -i content-type
curl -s https://vreeman.com/meditations/entries.json | head -c 200
curl -s -X POST https://vreeman.com/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"server/discover"}'
curl -s -X POST https://vreeman.com/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_meditations","arguments":{"query":"retreats"}}}'
curl -sD- -o/dev/null -X POST https://vreeman.com/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' | grep -i 'sunset\|deprecation'
```

Then validate with [isitagentready.com](https://isitagentready.com/) — `checks.discovery.agentSkills.status` should report `pass`.

**Step 5: Commit and open the PR**

```bash
git add tools/meditations-search/README.md README.md
git commit -m "Document the generated Meditations corpus"
```

Do not merge to `master` without the post-deploy checks in Step 4.

---

## Explicitly out of scope

Do not do these in this plan, even if they look adjacent:

- **`SearchAction` in the JSON-LD.** Blocked on `?q=` URL state, declined at design time. Its `target` is a URL consumers *fetch*; with no query state the markup would promise a URL the page ignores.
- **Adding `?q=` to `meditations/search.js`.** The decision was to keep it URL-less.
- **OKF v0.2.** The catalog's OKF entry stays at `0.1` in this branch.
- **Per-page `.md` endpoints** for the Stoic library.
