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
