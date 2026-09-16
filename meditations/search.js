// Search within Books 1–12 of the Meditations.
// Pure helpers are exported for tests (tools/meditations-search/test/).
// DOM access happens only in the adapter functions and mountSearch(); module top level is DOM-free.

// Entry ids are bookN-M, with an optional letter suffix for sub-entries (e.g. book4-49a).
const ENTRY_ID = /^book(\d+)-(\d+[a-z]?)$/;

// Fold curly quotes to straight ones for matching only. Each replacement is a single
// UTF-16 code unit, so offsets found in the folded string stay valid in the original text.
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

const BOOK_ID = /^book\d+$/;
const STRIP_SELECTOR = 'sup, .return'; // footnote markers and § return links are dropped; line breaks become spaces

export function visibleText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll(STRIP_SELECTOR).forEach(n => n.remove());
  clone.querySelectorAll('br').forEach(n => n.replaceWith(' '));
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
    if (!index) index = buildIndex(doc);
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
      // On narrow viewports the fixed panel would cover the entry just jumped to, so close it.
      a.addEventListener('click', () => { if (doc.defaultView.matchMedia('(max-width: 60em)').matches) close(false); });
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

  toggle.addEventListener('click', () => (isOpen() ? close(true) : open()));
  input.addEventListener('input', render);

  doc.addEventListener('keydown', (ev) => {
    const k = ev.key.toLowerCase();
    if ((ev.metaKey || ev.ctrlKey) && !ev.altKey && !ev.shiftKey && (k === 'k' || ev.code === 'KeyK')) {
      ev.preventDefault();
      open();
    } else if (ev.key === 'Escape' && !ev.isComposing && isOpen()) {
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
