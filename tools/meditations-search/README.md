# Meditations Books-only search

Client-side search for `meditations/index.html`, shipped as the ES module `meditations/search.js`
(loaded at the end of `<body>` via `<script type="module" src="search.js">`). No dependencies; the
markup lives in `<template id="search-template">` at the end of the page. On startup it is cloned and
inserted right after `<header>`, so the search icon follows the skip link in Tab order; no-JS visitors
see nothing. The CSS lives in the page's inline `<style>`.

## Scope

Only the twelve `<section id="book1">` … `<section id="book12">` inside `<main>` are indexed.
Chronology, Introduction, Notes, Index of Persons and the Table of Contents are never searched.

Entries are found by their markers: Book 1 uses `<h3 id="book1-N">` (17 entries); Books 2–12 use
`<strong id="bookN-M">` (482 entries, 11 of which are lettered sub-entries such as `book4-49a`,
labelled `4.49a`). Total: **499 entries**. The index is built lazily on first open (~20 ms in Chromium).

## Behaviour

- **Scroll controls:** Random/Search hide when scrolling down and return when scrolling up, with a
  12px movement threshold to ignore jitter. They remain visible within 80px of the top. Back to Top
  follows the same direction rule, but is hidden within 300px of the top. Open Search and keyboard
  focus keep controls visible; reduced-motion preferences disable the fade/slide transition.

- **Random paragraph:** the button to the left of Search jumps to an entry in Books 1–12. It chooses
  the marked pool 80% of the time and the unmarked pool 20%, then picks uniformly within that pool.
  Marks in continuation paragraphs count. If one pool is empty, it uses the other. The current entry
  at the reading line and the current fragment destination are excluded, including during smooth scrolling.
  Random closes Search and moves keyboard focus to the chosen entry.

- **Open:** the fixed top-right magnifier icon, or **Cmd/Ctrl+K** (focuses the field if already open). On
  layouts where that key produces a non-Latin letter (Cyrillic, Greek) the physical K position counts too.
- **Enter** in the field moves focus to the first result (on a phone this also dismisses the keyboard); Enter
  again follows it.
- **Close:** Escape (focus returns to the icon if it was inside the widget; the field is not cleared), clicking the
  icon again, or clicking outside (a scrollbar drag, or a drag that starts in the field, does not count).
- **Results:** a status line (`N entries match`) and one row per matching entry. The whole row is a link to
  `#bookN-M`: the entry label in bold, then a snippet of about 140 characters whose cuts are extended to word
  boundaries, with the hit wrapped in `<mark>`. Snippets are built from text nodes, never `innerHTML`.
- **Clicking a result** jumps to the entry. The panel stays open so the reader can step through hits, except
  on viewports up to 60em wide, where it would cover the entry (design §7.9).
- **Phones:** the panel shrinks to make room for the on-screen keyboard (pinch-zoom is factored out), so the
  keyboard does not cover the results. Emulated only; not yet checked on a device.

## Matching

- Case-insensitive substring match after **2+ characters**; results keep book/entry order.
- Curly quotes `‘ ’ “ ”` are folded to straight quotes, so `don't` finds `don’t`.
- An exact label such as `4.3` or `4.49a` matches that entry directly.
- Excluded from the indexed text: `<sup>` footnote markers and `.return` § links. Attribute text such as
  `<mark title>` tooltips is never part of `textContent`, so it is not searchable either.
- `<br>` and the boundaries of `<li>` and `<p>` descendants count as spaces, so words on either side stay
  apart even without whitespace between tags.

## Generated corpus

`meditations/entries.json` is the same 499 entries as a machine-readable file: `{ id, label, text }`
per entry, document order, one entry per line (210 KB). It is what the MCP server's
`search_meditations` tool searches, and it stands on its own as a typed edition of Books 1–12 that an
agent can fetch once instead of scraping 516 KB of HTML.

    node tools/meditations-search/build-index.mjs

Regenerate it whenever the Books change; `index.test.mjs` fails if the file and the page disagree.
Grouping, labels, the stripped leading `§ 4.3` and quote folding all come from `groupEntries()` in
`meditations/search.js`, so the corpus cannot drift from what readers search in the browser. `lower` is
not shipped — it is derivable, and carrying it would nearly double the file. `findMatches()` reads
`entry.lower` unconditionally and throws without it, so a consumer puts it back with **`withLower()`**,
exported from `meditations/search.js` and the same helper `groupEntries()` itself ends with. Do not
rehydrate by re-running `groupEntries()` over its own output: it strips a leading `§ N.M`, so a second
pass would truncate any entry whose text legitimately begins with its own number.

## `search_meditations` — the same search as an agent tool

The corpus and the matching in `search.js` are also what answers `search_meditations`, a tool this
site publishes on two surfaces under **one name and one `inputSchema`**: on the HTTP MCP server
(`functions/mcp.js`, <https://vreeman.com/mcp>) and via WebMCP in the page itself
(`meditations/webmcp.js`). An agent that met either recognises the other — which makes a
differently-shaped *answer* a trap rather than a nicety, so the answer has one implementation too:

- **`meditations/tool-result.js`** — `searchMeditations(entries, rawQuery)`, imported by both
  surfaces. It formats: the `N entries match "…" (trans. Hays)` head line, `MAX_RESULTS` = 20 with a
  "refine the query" note when capped, one `• label — text — https://vreeman.com/meditations/#id`
  line per hit, and the below-`MIN_QUERY` message that the page has no equivalent for. An exact entry
  number returns the entry **in full** rather than a snippet, because over a tool call the snippet is
  the whole answer rather than a link you click.
- The matching itself stays in `search.js`. Quote folding, label matching and snippet windowing have
  one definition for the reader's search box and the agent's tool call alike.

The two surfaces differ only in where the entries come from: the server fetches `entries.json` and
rehydrates it with `withLower()`; the browser calls `buildIndex(document)` over the rendered Books
and needs no corpus and no fetch at all. `webmcp.js` is loaded only after an inline guard in
`meditations/index.html` has found a `modelContext` to register with, so a reader whose browser has
no WebMCP downloads nothing. See `tools/mcp/README.md` for the server side.

## Tests

    node --test tools/meditations-search/test/*.test.mjs

- `search.test.mjs` — the pure helpers (whitespace normalisation, grouping, quote folding, matching,
  snippets) and the Cmd/Ctrl+K guard.
- `dom.test.mjs` — the DOM adapters (`visibleText`, `itemFromElement`, `buildIndex`) and `mountSearch()`,
  run against the small fake DOM in `fake-dom.mjs`.
- `scan-html.test.mjs` — the Node-side HTML scanner in `lib/scan-html.mjs`, checked against the
  browser's `buildIndex()` on the same markup so the two walks cannot diverge.
- `index.test.mjs` — the generated corpus: 499 entries in document order, byte-identical to what
  `build-index.mjs` produces from the current HTML, free of entities and § markers, and searchable
  (words inside the Books are found, words from the Introduction, Notes and Index of Persons are not).
- `webmcp.test.mjs` — the browser tool in `meditations/webmcp.js`, against a fake DOM built from the
  shipped corpus. Its output is compared against `dispatch()`'s own over the same entries rather than
  against hand-written strings, so the two surfaces cannot answer the same query differently. Also
  covers all three registration paths (`document.modelContext.registerTool`, the declarative
  `provideContext` fallback, and installing nothing when neither exists), the shared empty-query
  refusal, and that the index is built once and kept.
- `markup.test.mjs` — guards the page-markup assumptions in `meditations/index.html`: 12 Book sections as
  direct, unnested children of `<main>` with all 17 + 482 = 499 entry markers inside them, the module `<script>`
  tag, the print rule that hides `.search`, `<template id="search-template">` with the five ids `mountSearch()`
  looks up and the input's `enterkeyhint`, the `<header>` mount point, the toggle's focus style, the `.search`
  stacking order, the panel's visual-viewport height and the labels' lining figures. It also asserts that every
  `h3`/`strong` id inside a Book is entry-shaped, which is what keeps the DOM walk and the scanner
  from disagreeing about an element whose first `strong[id]` is not a marker.
- `screensaver.test.mjs` — the screensaver's passages are exactly what `build-screensaver.mjs` produces from the
  current highlights, the shuffle completes each cycle without repeating across the boundary, previous/next
  revisits history, and longer passages get more reading time.
- `screensaver-head.test.mjs` — the head's motion math (the rest pose reproduces the drawing, a turn moves the face
  more than the silhouette, gaze limits, the exact spring, the drift), the generated drawing's shape and depth, and
  `mountHead()`'s scheduling against a fake browser with a manual clock: animation frames only while he turns, a
  slow timer while he drifts, nothing while the tab is hidden, and one still frame under reduced motion. On macOS only (it needs `sips`), it also checks that `head-data.js` is
  byte-identical to the output of `build-screensaver-head.mjs`.

## Local testing

Module scripts are fetched with CORS, so the page must be served over HTTP; `file://` will not load the search.

    python3 -m http.server 8765 --bind 127.0.0.1

Run from the repo root, then open <http://localhost:8765/meditations/>.
