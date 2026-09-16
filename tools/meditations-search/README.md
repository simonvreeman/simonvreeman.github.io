# Meditations Books-only search

Client-side search for `meditations/index.html`, shipped as the ES module `meditations/search.js`
(loaded at the end of `<body>` via `<script type="module" src="search.js">`). No dependencies; the
markup lives in `<template id="search-template">` at the end of the page and is cloned on startup,
so no-JS visitors see nothing. The CSS lives in the page's inline `<style>`.

## Scope

Only the twelve `<section id="book1">` … `<section id="book12">` inside `<main>` are indexed.
Chronology, Introduction, Notes, Index of Persons and the Table of Contents are never searched.

Entries are found by their markers: Book 1 uses `<h3 id="book1-N">` (17 entries); Books 2–12 use
`<strong id="bookN-M">` (482 entries, 11 of which are lettered sub-entries such as `book4-49a`,
labelled `4.49a`). Total: **499 entries**. The index is built lazily on first open (~20 ms in Chromium).

## Behaviour

- **Open:** the fixed top-right magnifier icon, or **Cmd/Ctrl+K** (focuses the field if already open).
- **Close:** Escape (focus returns to the icon; the field is not cleared), clicking the icon again, or clicking outside.
- **Results:** a status line (`N entries match`) and a list of entry label (link to `#bookN-M`) plus a
  ~140-character snippet with the hit wrapped in `<mark>`. Snippets are built from text nodes, never `innerHTML`.
- **Clicking a result** jumps to the entry; the panel stays open so the reader can step through hits.

## Matching

- Case-insensitive substring match after **2+ characters**; results keep book/entry order.
- Curly quotes `‘ ’ “ ”` are folded to straight quotes, so `don't` finds `don’t`.
- An exact label such as `4.3` or `4.49a` matches that entry directly.
- Excluded from the indexed text: `<sup>` footnote markers, `.return` § links, and `<mark title>` tooltips.
  `<br>` is treated as a space so words on either side stay apart.

## Tests

    node --test tools/meditations-search/test/*.test.mjs

- `search.test.mjs` — the pure helpers (text extraction, quote folding, matching, snippets).
- `markup.test.mjs` — guards the page-markup assumptions: 12 Book sections, 17 + 482 = 499 entry
  markers, and the module `<script>` tag being present in `meditations/index.html`.

## Local testing

Module scripts are fetched with CORS, so the page must be served over HTTP; `file://` will not load the search.

    python3 -m http.server 8765 --bind 127.0.0.1

Run from the repo root, then open <http://localhost:8765/meditations/>.
