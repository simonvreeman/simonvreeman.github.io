# Meditations page: search within the twelve Books — Design

- **Date:** 2026-09-16
- **Status:** Implemented 2026-09-16 (see [implementation plan](2026-09-16-meditations-search-implementation.md))
- **Author:** Simon Vreeman (with Claude Code)
- **Scope:** Add a client-side search to `meditations/index.html` that searches **only Books 1–12** of the *Meditations*. Chronology, Introduction, Notes, Index of Persons and the Table of Contents are never searched.

---

## 1. Decisions (locked)

| Decision | Choice |
|---|---|
| Scope of the index | The twelve `<section id="bookN">` elements only, by construction |
| Engine | Prebuilt in-memory index of 499 entries, built on first open; substring filter per keystroke |
| Trigger | A magnifying-glass **icon** fixed top right; click expands it into a search field. Also **Cmd/Ctrl+K** |
| Results | List under the field: entry number (link) + ~140-char snippet with the hit in `<mark>` |
| Click on a result | Jumps to the entry; the **panel stays open** so the reader can step through hits |
| Close | Escape, clicking the icon again, or clicking outside; focus returns to the icon |
| Dependencies | None. Inline `<script>` + a short block in the existing inline `<style>` |
| Other pages | No changes. This is Meditations-only |

## 2. Page facts the design relies on

- Single 500 KB file, `meditations/index.html`. Sections in order: `#chronology`, `#introduction`, `#book1` … `#book12`, `#notes`, `#persons`. A `<nav>` Table of Contents precedes `<main>`.
- **Entry anchors.** Book 1 marks entries with `<h3 id="book1-N">`; Books 2–12 mark them with `<p><a class="return">§</a> <strong id="bookN-M">N.M</strong> …</p>`. Continuation `<p>`/`<ul>`/`<blockquote>` siblings follow until the next marker. Total: 499 entries (11 are lettered sub-entries such as `book4-49a`).
- Existing fixed elements: `#progress` (top, 2 px) and `.fixed` back-to-top arrow (bottom right). The icon goes top right, below the progress bar; no collision.
- Styling: CSS variables in `:root` (`--eigengrau`, `--blue-*`, `--white`, `--sans-serif`, `--serif`), dark mode via `prefers-color-scheme`, `mark` already styled in both schemes, `[id] { scroll-margin-top: 2ex }`, print stylesheet hides `.fixed` and `.return`.
- There is already one small inline script at the end of `<body>` (load-time footer). No external JS anywhere on the site.

## 3. Components

### 3.1 Markup (in the page, inside an inert `<template>`; see deviation 10)

```
<div id="search" class="search">
  <button id="search-toggle" type="button" aria-label="Search the Books" aria-expanded="false" aria-controls="search-panel" aria-keyshortcuts="Meta+K Control+K">
    <svg …magnifying glass in currentColor…></svg>
  </button>
  <div id="search-panel" role="search" hidden>
    <input id="search-input" type="search" placeholder="Search Books 1–12" autocomplete="off" spellcheck="false" aria-label="Search Books 1–12">
    <p id="search-status" aria-live="polite"></p>
    <ol id="search-results"></ol>
  </div>
</div>
```

### 3.2 Index

Built lazily on the first open. For each `section[id^="book"]` whose id matches `/^book\d+$/`:

1. Skip the `h2`.
2. Iterate child elements in order. A child **starts a new entry** if it is `h3[id^="bookN-"]` or contains a `strong[id^="bookN-"]`. Otherwise it is appended to the current entry.
3. Per entry, store `{ id, label, text, lower }` where `label` is `N.M` with an optional letter suffix (e.g. `4.49a`, taken from the marker text), `text` is the visible text with `sup` (footnote markers) and `.return` (§ links) removed and whitespace collapsed, and `lower` is `text.toLowerCase()`.

### 3.3 Matching

- Query is trimmed and lower-cased. Fewer than **2 characters** → clear results and status.
- Entry matches if `lower.includes(q)` **or** `label === q` (so typing `4.3` finds entry 4.3 directly).
- Results keep book/entry order.

### 3.4 Results rendering

- Status line: `N entries match` / `1 entry matches` / `No entries match`.
- Each `<li>`: `<a href="#bookN-M"><strong>N.M</strong></a> ` then the snippet: ~140 characters centred on the first hit, `…` at trimmed ends, the hit wrapped in `<mark>`. Snippet is built from text nodes, never `innerHTML` from the query, so no injection risk.
- Clicking a result: default anchor navigation (page scrolls, `:target` styling applies). Panel remains open.

### 3.5 Interaction

- Toggle button click → open/close. On open: unhide panel, set `aria-expanded="true"`, focus the input, select its contents.
- **Cmd/Ctrl+K** anywhere → `preventDefault`, open (or focus if already open).
- **Escape** while the panel is open → close, return focus to the toggle.
- Click outside `#search` → close (focus not moved).
- Panel state is not persisted.

### 3.6 Styling (added to the existing `<style>`)

- `.search` fixed, `top: .75rem; right: 1em; z-index` above content, `font-family: var(--sans-serif)`.
- Toggle: 2.5 rem square, transparent background, `color: inherit`, subtle border using `currentColor` at low alpha; visible focus via the existing global `:focus` outline.
- Panel: positioned under the toggle, right-aligned, `width: min(28em, calc(100vw - 2em))`, background `var(--white)` (dark: `var(--eigengrau)`), 1 px border, `max-height: 70vh`, `overflow: auto`, `font-size: 1rem`.
- Results list: no markers; each item separated by a hairline; entry number bold.
- `@media print { .search { display: none } }`.
- No transitions, so the existing reduced-motion rules need no additions.

## 4. Error handling

- No entries found in a Book section (unexpected markup) → that section contributes nothing; search still works for the rest.
- Script runs after DOM is parsed (placed at end of `<body>`), so no `DOMContentLoaded` dependency.
- If `matchMedia`/`hidden` are unsupported the feature simply does not appear; the page is unaffected.

## 5. Verification

Manual, in the built-in browser against a local static server (`python3 -m http.server` from the repo root), plus a small Node script that re-derives the 499-entry index from the HTML so counts can be cross-checked.

- **Positive probes:** `Verus` (Book 1.1 and 1.2 among others), `tranquillity` (4.3), `4.3` (exact label), `logos` (many).
- **Negative probes:** words that appear only outside the Books must return **No entries match** — e.g. `Hays` (Introduction), `Haines` / `Loeb` (Notes/Further reading), a name that occurs only in the Index of Persons.
- Keyboard: Cmd/Ctrl+K opens and focuses; Escape closes and returns focus to the icon; Tab order sane.
- Result click scrolls to the entry, panel stays open; Escape then closes.
- Light and dark schemes; 375 px viewport (panel fits, no horizontal scroll); print preview hides the icon.

## 6. Out of scope (YAGNI)

Fuzzy or whole-word matching, multi-term AND/OR, searching the Introduction/Notes/Index, persisting the last query, analytics events, a `/` shortcut, reuse on other pages.

## 7. Deviations recorded during implementation

1. Shipped as the external module `meditations/search.js` (deferred `<script type="module">`) rather than inline JS, for testability. CSS remains inline.
2. Entry count is 499, not 488: 11 lettered sub-entries (`4.49a` etc.) are indexed as their own entries.
3. Typographic quotes (`‘’“”`) are folded to straight quotes for matching.
4. `<br>` is treated as a space when extracting text.
5. Toggle and panel have opaque backgrounds (`--white` / `--eigengrau`) rather than transparent, so text scrolling underneath doesn't show through.
6. §3.4's ":target styling applies" is inaccurate — the page has no `:target` rule; the entry is positioned via `scroll-margin-top` only.
7. Results `<ol>` has `role="list"` and the status `<p>` has `role="status"`.
8. No `.claude/launch.json` was committed: the preview launcher's child process is denied access to `~/Documents` on this Mac, so local testing uses a plain background `python3 -m http.server`.
9. On viewports up to 60em wide, clicking a result also closes the panel, because the fixed panel would otherwise cover the entry the reader just jumped to. On wider viewports the panel stays open as designed.
10. The widget markup lives in the page, in `<template id="search-template">` at the end of `<body>`, and `mountSearch()` clones it. §3.1 originally built the markup from a string inside the module. Moving it keeps HTML and CSS together in the HTML file where both are editable as markup, while a template's inert contents preserve the original property that readers without JavaScript see nothing. As a side effect the module no longer uses `innerHTML` at all.
