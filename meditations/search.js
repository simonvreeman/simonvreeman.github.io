// Search within Books 1–12 of the Meditations.
// The pure helpers (through isSearchShortcut) and the DOM adapters are exported for the node tests in
// tools/meditations-search/test/ (the adapters run against a small fake DOM there) and for console
// checks via import(). The only top-level DOM access is the guarded auto-mount on the last line.

// Entry ids are bookN-M, with an optional letter suffix for sub-entries (e.g. book4-49a).
const ENTRY_ID = /^book(\d+)-(\d+[a-z]?)$/;

// Fold curly quotes to straight ones for matching only. snippet() slices entry.text by offsets found
// in entry.lower, so lower must stay index-aligned with text: each replacement here is one UTF-16 code
// unit, and toLowerCase() preserves length for everything in the Books (U+0130 İ is the only exception).
const foldQuotes = s => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

export function normalizeText(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

// items: [{ marker: 'book4-3' | 'book4-49a' | null, text: '…' }] in document order.
// Returns [{ id, label, text, lower }]; label is '4.3' or '4.49a'.
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
      t = t.replace(new RegExp(`^[§\\s]*${m[1]}\\.${m[2]}(?!\\d)\\s*`), '');
    }
    if (!current || !t) continue;
    current.text = current.text ? `${current.text} ${t}` : t;
  }
  for (const e of entries) e.lower = foldQuotes(e.text).toLowerCase();
  return entries;
}

export const MIN_QUERY = 2;

// Returns { query, matches }. query is the normalised, lower-cased term.
export function findMatches(entries, rawQuery) {
  const query = foldQuotes(normalizeText(rawQuery)).toLowerCase();
  if (query.length < MIN_QUERY) return { query, matches: [] };
  const matches = entries.filter(e => e.label === query || e.lower.includes(query));
  return { query, matches };
}

export function statusText(n) {
  if (n === 0) return 'No entries match';
  return n === 1 ? '1 entry matches' : `${n} entries match`;
}

export const SNIPPET_RADIUS = 70;

// Text is whitespace-normalised; extend a cut to the end of its word.
function wordEnd(text, offset) {
  let end = Math.min(text.length, offset);
  while (end < text.length && text[end] !== ' ' && text[end - 1] !== ' ') end++;
  return end;
}

// Pieces of entry.text around the first occurrence of query (already lower-cased).
export function snippet(entry, query, radius = SNIPPET_RADIUS) {
  const text = entry.text;
  const i = query ? entry.lower.indexOf(query) : -1;
  if (i < 0) {
    const cut = wordEnd(text, radius * 2);
    return { before: text.slice(0, cut).trimEnd(), hit: '', after: '', leading: false, trailing: text.length > cut };
  }
  let start = Math.max(0, i - radius);
  while (start > 0 && text[start] !== ' ' && text[start - 1] !== ' ') start--;
  const end = wordEnd(text, i + query.length + radius);
  return {
    before: text.slice(start, i).trimStart(),
    hit: text.slice(i, i + query.length),
    after: text.slice(i + query.length, end).trimEnd(),
    leading: start > 0,
    trailing: end < text.length,
  };
}

// Cmd/Ctrl+K opens the search. ev.key is what the layout produced; the physical KeyK position counts
// only when that is not a Latin letter (Cyrillic, Greek…), so Cmd+T on Dvorak stays a new tab.
export function isSearchShortcut(ev) {
  if (!(ev.metaKey || ev.ctrlKey) || ev.altKey || ev.shiftKey) return false;
  const k = (ev.key || '').toLowerCase();
  return k === 'k' || (ev.code === 'KeyK' && !/^\p{Script=Latin}$/u.test(k));
}

const BOOK_ID = /^book\d+$/;
const STRIP_SELECTOR = 'sup, .return'; // footnote markers and § return links
// textContent joins nodes with nothing in between, so line breaks and block descendants are padded
// with spaces; otherwise "…world.</li><li>My…" would fuse into "world.My" without whitespace between tags.
const PAD_SELECTOR = 'br, li, p';

export function visibleText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll(STRIP_SELECTOR).forEach(n => n.remove());
  clone.querySelectorAll(PAD_SELECTOR).forEach(n => { n.before(' '); n.after(' '); });
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
  for (const section of doc.querySelectorAll('main > section[id]')) {
    if (!BOOK_ID.test(section.id)) continue;
    for (const child of section.children) {
      if (child.tagName === 'H2') continue;
      items.push(itemFromElement(child));
    }
  }
  return groupEntries(items);
}

// The widget's markup lives in <template id="search-template"> in the page, so it can be
// edited as HTML. A template's contents are inert, so readers without JavaScript still see
// nothing rather than a search box that cannot search.
const TEMPLATE_ID = 'search-template';

export function mountSearch(doc) {
  const template = doc.getElementById(TEMPLATE_ID);
  if (!template || !template.content) return null;
  const root = template.content.firstElementChild?.cloneNode(true);
  if (!root) return null;

  const toggle = root.querySelector('#search-toggle');
  const panel = root.querySelector('#search-panel');
  const input = root.querySelector('#search-input');
  const status = root.querySelector('#search-status');
  const results = root.querySelector('#search-results');
  if (!toggle || !panel || !input || !status || !results) return null; // hand-edited template: leave the page alone

  // Mount right after <header> so the toggle follows the skip link in Tab order. .search is
  // position: fixed, so its place in the DOM has no layout effect, but it now precedes the .fixed
  // back-to-top link, so .search takes z-index 11 to keep the open panel painting above that disc.
  const header = doc.getElementById('header');
  if (header) header.after(root); else doc.body.appendChild(root);
  let index = null;
  // Built lazily on first open. render() calls it too so the order never matters: on the page the field sits
  // in the hidden panel, so open() always comes first, but tests and console checks can fire input cold.
  const ensureIndex = () => index ?? (index = buildIndex(doc));

  const isOpen = () => !panel.hidden;

  // A phone's on-screen keyboard shrinks only the visual viewport, which dvh and position: fixed ignore,
  // so expose that height for the panel's max-height (see the #search-panel rule). height * scale factors
  // pinch-zoom (and iOS's auto-zoom on focus) back out, so only the keyboard shrinks the panel.
  const vv = doc.defaultView.visualViewport;
  if (vv) {
    const track = () => root.style.setProperty('--vvh', `${Math.round(vv.height * vv.scale)}px`);
    vv.addEventListener('resize', track);
    track();
  }

  function open() {
    ensureIndex();
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

  // <li><a href="#bookN-M"><strong>N.M</strong> <span class="search-snippet">…<mark>hit</mark>…</span></a></li>
  function resultItem(entry, query) {
    const li = doc.createElement('li');
    const a = doc.createElement('a');
    a.href = `#${entry.id}`;
    const strong = doc.createElement('strong');
    strong.textContent = entry.label;
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
    a.append(strong, ' ', span);
    li.appendChild(a);
    return li;
  }

  function render() {
    const { query, matches } = findMatches(ensureIndex(), input.value);
    status.textContent = query.length < MIN_QUERY ? '' : statusText(matches.length);
    results.replaceChildren(...matches.map(entry => resultItem(entry, query)));
  }

  toggle.addEventListener('click', () => (isOpen() ? close(true) : open()));
  input.addEventListener('input', render);

  // On narrow viewports the fixed panel would cover the entry just jumped to, so a result click closes it.
  results.addEventListener('click', (ev) => {
    if (ev.target.closest('a') && doc.defaultView.matchMedia('(max-width: 60em)').matches) close(false);
  });

  // Keys that commit or cancel an IME composition are the IME's, not ours. keyCode 229: Safari before the
  // WebKit fix for bug 311717 (2026-04) fires the commit key after compositionend, with isComposing false.
  const composing = ev => ev.isComposing || ev.keyCode === 229;

  doc.addEventListener('keydown', (ev) => {
    if (isSearchShortcut(ev)) {
      ev.preventDefault();
      open();
    } else if (ev.key === 'Escape' && !composing(ev) && isOpen()) {
      ev.preventDefault(); // also stops type=search from clearing the field
      close(root.contains(doc.activeElement)); // after a result click focus is on the page: leave it there
    } else if (ev.key === 'Enter' && !composing(ev) && ev.target === input && isOpen()) {
      ev.preventDefault();
      results.querySelector('a')?.focus(); // off the field, which also dismisses a phone keyboard
    }
  });

  // A click outside the widget closes it. Listen for click, not pointerdown (Chromium reports a scrollbar
  // drag as a pointerdown on <html>), and for pointer clicks only when the press started outside too: a
  // drag that begins in the field and ends past the panel dispatches its click on the common ancestor,
  // <body>. Keyboard, assistive-technology and script clicks carry detail 0 and have no pointerdown of
  // their own, so they never consult the flag (a press inside that ends without a click would stale it).
  let pressOutside = true;
  doc.addEventListener('pointerdown', (ev) => { pressOutside = !root.contains(ev.target); });
  doc.addEventListener('click', (ev) => {
    if (isOpen() && !root.contains(ev.target) && (pressOutside || ev.detail === 0)) close(false);
  });

  return root;
}

if (typeof document !== 'undefined') mountSearch(document);
