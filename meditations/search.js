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
