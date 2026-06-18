const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&mdash;': '—', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”' };
export function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}
// Longest verbatim prefix that ends on a sentence boundary and fits within `limit`.
export function firstSentencesWithin(text, limit = 600) {
  if ([...text].length <= limit) return text;
  const slice = text.slice(0, limit);
  const lastStop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (lastStop > 0) return slice.slice(0, lastStop + 1).trim();
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim();
}
