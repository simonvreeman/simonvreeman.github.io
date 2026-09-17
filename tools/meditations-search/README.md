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

## Tests

    node --test tools/meditations-search/test/*.test.mjs

- `search.test.mjs` — the pure helpers (whitespace normalisation, grouping, quote folding, matching,
  snippets) and the Cmd/Ctrl+K guard.
- `dom.test.mjs` — the DOM adapters (`visibleText`, `itemFromElement`, `buildIndex`) and `mountSearch()`,
  run against the small fake DOM in `fake-dom.mjs`.
- `markup.test.mjs` — guards the page-markup assumptions in `meditations/index.html`: 12 Book sections as
  direct, unnested children of `<main>` with all 17 + 482 = 499 entry markers inside them, the module `<script>`
  tag, the print rule that hides `.search`, `<template id="search-template">` with the five ids `mountSearch()`
  looks up and the input's `enterkeyhint`, the `<header>` mount point, the toggle's focus style, the `.search`
  stacking order, the panel's visual-viewport height and the labels' lining figures.

## Local testing

Module scripts are fetched with CORS, so the page must be served over HTTP; `file://` will not load the search.

    python3 -m http.server 8765 --bind 127.0.0.1

Run from the repo root, then open <http://localhost:8765/meditations/>.
