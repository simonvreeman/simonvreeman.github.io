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
