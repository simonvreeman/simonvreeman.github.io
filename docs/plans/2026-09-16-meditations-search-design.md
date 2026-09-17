# Meditations page: search within the twelve Books — Design

- **Date:** 2026-09-16
- **Status:** Implemented 2026-09-16 (see [implementation plan](2026-09-16-meditations-search-implementation.md)); reviewed and amended 2026-09-17 (deviations 11–23)
- **Author:** Simon Vreeman (with Claude Code)
- **Scope:** Add a client-side search to `meditations/index.html` that searches **only Books 1–12** of the *Meditations*. Chronology, Introduction, Notes, Index of Persons and the Table of Contents are never searched.

---

## 1. Decisions (locked)

| Decision | Choice |
|---|---|
| Scope of the index | The twelve `<section id="bookN">` elements only, by construction |
| Engine | Prebuilt in-memory index of 499 entries, built on first open; substring filter per keystroke |
| Trigger | A magnifying-glass **icon** fixed top right; click expands it into a search field. Also **Cmd/Ctrl+K** |
| Results | List under the field: entry number (link) + ~140-char snippet with the hit in `<mark>` (see deviations 11–12) |
| Click on a result | Jumps to the entry; the **panel stays open** so the reader can step through hits (see deviation 9) |
| Close | Escape, clicking the icon again, or clicking outside; Escape (when focus was inside the widget, see deviation 17) and the icon return focus to the icon, clicking outside leaves focus where it is (see deviation 18) |
| Dependencies | None. Inline `<script>` + a short block in the existing inline `<style>` |
| Other pages | No changes. This is Meditations-only |

## 2. Page facts the design relies on

- Single 500 KB file, `meditations/index.html`. Sections in order: `#chronology`, `#introduction`, `#book1` … `#book12`, `#notes`, `#persons`. A `<nav>` Table of Contents precedes `<main>`.
- **Entry anchors.** Book 1 marks entries with `<h3 id="book1-N">`; Books 2–12 mark them with `<p><a class="return">§</a> <strong id="bookN-M">N.M</strong> …</p>`. Continuation `<p>`/`<ul>`/`<blockquote>` siblings follow until the next marker. Total: 499 entries (11 are lettered sub-entries such as `book4-49a`).
- Existing fixed elements: `#progress` (top, 2 px) and `.fixed` back-to-top arrow (bottom right). The icon goes top right, below the progress bar; no collision.
- Styling: CSS variables in `:root` (`--eigengrau`, `--blue-*`, `--white`, `--sans-serif`, `--serif`), dark mode via `prefers-color-scheme`, `mark` already styled in both schemes, `[id] { scroll-margin-top: 2ex }`, print stylesheet hides `.fixed` and `.return`.
- There is already one small inline script at the end of `<body>` (load-time footer). No external JS anywhere on the site.

## 3. Components

### 3.1 Markup (in the page, inside an inert `<template>`; see deviations 7, 10, 13 and 20)

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
3. Per entry, store `{ id, label, text, lower }` where `label` is `N.M` with an optional letter suffix (e.g. `4.49a`, derived from the marker id), `text` is the visible text with `sup` (footnote markers) and `.return` (§ links) removed and whitespace collapsed, and `lower` is `foldQuotes(text).toLowerCase()`.

### 3.3 Matching

- Query is trimmed and lower-cased. Fewer than **2 characters** → clear results and status.
- Entry matches if `lower.includes(q)` **or** `label === q` (so typing `4.3` finds entry 4.3 directly).
- Results keep book/entry order.

### 3.4 Results rendering (see deviations 6, 9, 11 and 12)

- Status line: `N entries match` / `1 entry matches` / `No entries match`.
- Each `<li>`: `<a href="#bookN-M"><strong>N.M</strong></a> ` then the snippet: ~140 characters centred on the first hit, `…` at trimmed ends, the hit wrapped in `<mark>`. Snippet is built from text nodes, never `innerHTML` from the query, so no injection risk.
- Clicking a result: default anchor navigation (page scrolls, `:target` styling applies). Panel remains open.

### 3.5 Interaction

- Toggle button click → open/close. On open: unhide panel, set `aria-expanded="true"`, focus the input, select its contents.
- **Cmd/Ctrl+K** anywhere → `preventDefault`, open (or focus if already open); see deviation 14.
- **Escape** while the panel is open → close, return focus to the toggle (see deviation 17).
- Click outside `#search` → close (focus not moved; see deviation 18).
- Panel state is not persisted.
- **Enter** in the field → focus the first result (see deviation 20).

### 3.6 Styling (added to the existing `<style>`; see deviations 5, 13, 15, 19 and 21)

- `.search` fixed, `top: .75rem; right: 1em; z-index` above content, `font-family: var(--sans-serif)`.
- Toggle: 2.5 rem square, transparent background, `color: inherit`, subtle border using `currentColor` at low alpha; visible focus via the existing global `:focus` outline.
- Panel: positioned under the toggle, right-aligned, `width: min(28em, calc(100vw - 2em))`, background `var(--white)` (dark: `var(--eigengrau)`), 1 px border, `max-height: 70vh`, `overflow: auto`, `font-size: 1rem`.
- Results list: no markers; each item separated by a hairline; entry number bold.
- `@media print { .search { display: none } }`.
- No transitions, so the existing reduced-motion rules need no additions.

## 4. Error handling

- No entries found in a Book section (unexpected markup) → that section contributes nothing; search still works for the rest.
- Script runs after DOM is parsed (placed at end of `<body>`), so no `DOMContentLoaded` dependency.
- `mountSearch()` returns `null` without touching the page if `<template id="search-template">` is missing or empty, or if any of the five ids inside it (`search-toggle`, `search-panel`, `search-input`, `search-status`, `search-results`) is missing; `markup.test.mjs` guards them.

## 5. Verification

Manual, in the built-in browser against a local static server (`python3 -m http.server` from the repo root), plus `tools/meditations-search/test/markup.test.mjs`, which re-derives the 12 sections and 17 + 482 = 499 markers from the HTML so `buildIndex(document).length` in the browser can be cross-checked, and `dom.test.mjs`, which runs the DOM adapters and `mountSearch()` against a small fake DOM.

- **Positive probes:** `Verus` (Book 1.1 and 1.2 among others), `tranquillity` (4.3), `4.3` (exact label), `logos` (many).
- **Negative probes:** words that appear only outside the Books must return **No entries match** — e.g. `Hays` (Introduction), `Haines` / `Loeb` (Notes/Further reading), a name that occurs only in the Index of Persons.
- Keyboard: Cmd/Ctrl+K opens and focuses; Escape closes and returns focus to the icon (when focus was inside the widget, deviation 17); Tab order sane. Both keys are also covered by `dom.test.mjs`.
- Result click scrolls to the entry, panel stays open (closes on viewports up to 60em, deviation 9); Escape then closes.
- Light and dark schemes; 375 px viewport (panel fits, no horizontal scroll); print preview hides the icon.

## 6. Out of scope (YAGNI)

Fuzzy or whole-word matching, multi-term AND/OR, searching the Introduction/Notes/Index, persisting the last query, analytics events, a `/` shortcut, reuse on other pages.

## 7. Deviations recorded during implementation

1. Shipped as the external module `meditations/search.js` (deferred `<script type="module">`) rather than inline JS, for testability. CSS remains inline.
2. Entry count is 499, not 488: 11 lettered sub-entries (`4.49a` etc.) are indexed as their own entries.
3. Typographic quotes (`‘’“”`) are folded to straight quotes for matching.
4. `<br>` and the boundaries of `<li>` and `<p>` descendants are treated as spaces when extracting text, so words stay apart even without whitespace between tags.
5. Toggle and panel have opaque backgrounds rather than transparent, so text scrolling underneath doesn't show through. The toggle shares the `.fixed` rule: 2.75rem, borderless, `#fff` in light mode so it disappears into the canvas; the panel uses `--white`; both use `--eigengrau` in dark mode.
6. §3.4's ":target styling applies" is inaccurate — the page has no `:target` rule; the entry is positioned via `scroll-margin-top` only.
7. Results `<ol>` has `role="list"` and the status `<p>` has `role="status"`.
8. No `.claude/launch.json` was committed: the preview launcher's child process is denied access to `~/Documents` on this Mac, so local testing uses a plain background `python3 -m http.server`.
9. On viewports up to 60em wide, clicking a result also closes the panel, because the fixed panel would otherwise cover the entry the reader just jumped to. On wider viewports the panel stays open as designed.
10. The widget markup lives in the page, in `<template id="search-template">` at the end of `<body>`; `mountSearch()` clones it and inserts the clone right after `<header>`, so the toggle follows the skip link in Tab order. `.search` is `position: fixed`, so placement has no layout effect, but the widget now precedes the `.fixed` back-to-top link in the DOM, so `.search` has `z-index: 11` (the link keeps 10) and the open panel still paints above that disc on short viewports. §3.1 originally built the markup from a string inside the module. Moving it keeps HTML and CSS together in the HTML file where both are editable as markup, while a template's inert contents preserve the original property that readers without JavaScript see nothing. As a side effect the module no longer uses `innerHTML` at all.
11. (91d8eb3) The snippet `<span>` is rendered inside the result `<a>`, so the whole row is the link and its accessible name is the label followed by the snippet; `#search-results a` is a block with `min-height: 44px` and `.search-snippet` resets the colour.
12. (d33e0e0) Snippet cuts are extended to the nearest word boundary on both sides (`wordEnd` and the backward scan in `snippet()`), then trimmed, so a snippet is about 140 characters plus at most one partial word each side. Covered by `search.test.mjs`.
13. The panel is a flex column with `overflow: hidden`; only `#search-results` scrolls. The input placeholder is "Search Meditations", its aria-label "Search Meditations Books 1–12", and the toggle carries a `title` naming the shortcut.
14. Cmd/Ctrl+K also accepts the physical K position (`KeyboardEvent.code`) when the layout produced a non-Latin character, so Cyrillic and Greek keyboards work; on Latin layouts only the produced letter counts, so Cmd+T on Dvorak stays a new tab (`isSearchShortcut()`).
15. The toggle has its own `:focus-visible` colour in both schemes; the global `:focus` outline (`--blue-lighter`, 2.06:1 on the white disc) remains but is no longer the only indicator.
16. `mountSearch()` looks up the five widget ids before inserting the clone and returns `null` if any is missing, so a hand-edited template cannot ship a visible dead icon.
17. Escape returns focus to the icon only when focus was inside the widget. After a result click on a wide viewport, fragment navigation has moved focus to the page, and Escape leaves it there instead of jumping back to the icon.
18. Click-outside listens for `click`, not `pointerdown`: Chromium reports a scrollbar drag as a `pointerdown` on `<html>`, which closed the panel while the reader scrolled. For pointer clicks the press must also have started outside `#search`: a drag that begins in the field and is released past the panel dispatches its click on `<body>`, and must not close the panel mid-edit. Keyboard, assistive-technology and script clicks (`detail` 0) have no press of their own and always count.
19. The panel's `max-height` also follows `--vvh`, set on `.search` by `mountSearch()` from `visualViewport.height × scale`, i.e. the layout viewport minus the on-screen keyboard with pinch-zoom factored out on purpose (`min(70dvh, calc(var(--vvh, 100dvh) - 4.5rem))`), because a phone's keyboard shrinks only the visual viewport, which `dvh` and `position: fixed` ignore. Emulated in Chromium only; not verified on a device.
20. Enter in the field (`enterkeyhint="search"`) moves focus to the first result, which on phones dismisses the keyboard; Enter again follows the link. Enter and Escape that belong to an IME composition are ignored (`isComposing`, plus `keyCode` 229 for Safari builds that fire the commit key after `compositionend`; not verified in Safari).
21. `#search-results a strong` sets `font-feature-settings: 'lnum' on, 'tnum' on` alongside `font-variant-numeric`, because `body` sets `"onum" 1` and the low-level property wins in the shaper (the page's tables use the same idiom).
22. `markup.test.mjs` also checks that `<main>` holds only top-level sections and that all 499 markers sit inside the Books, the `main > section[id]` invariant `buildIndex()` depends on.
23. Result rows are built by `resultItem()`, the narrow-viewport close (deviation 9) is one delegated `click` listener on `#search-results`, and the lazy index is `ensureIndex()`.
