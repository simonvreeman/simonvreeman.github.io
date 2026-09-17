// Node-side counterpart to the DOM walk in meditations/search.js (visibleText, itemFromElement,
// buildIndex). Produces the [{ marker, text }] array groupEntries() consumes, so every rule downstream
// of that — labels, quote folding, whitespace — comes from the shipped module, not from here.
//
// Deliberately not a general HTML parser: it handles the markup meditations/index.html actually uses.
// What keeps that honest is the residue check in scanBooks() — every byte of a Book section must fall
// inside an indexed child — so unfamiliar markup throws instead of being silently dropped or re-split.
//
// tools/entitymap/lib/text.mjs has its own stripTags/ENTITIES with the opposite unknown-entity policy
// (pass the source through untouched). That suits prose blurbs; it must not be merged with this one,
// where a literal "&amp;" would travel into the agent corpus unnoticed.

import { normalizeText } from '../../../meditations/search.js';

// Exhaustive for meditations/index.html as of 2026-09-17; &#8984; is used elsewhere on the site.
// There is no &amp; in the Books. Unknown entities throw rather than pass through: a literal "&amp;"
// in the corpus would be invisible in review and wrong in every agent answer.
const ENTITIES = {
  '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
  '&#167;': '§', '&#35;': '#', '&#8984;': '⌘',
  '&lt;': '<', '&gt;': '>',
};

export function decodeEntities(s) {
  return String(s).replace(/&[a-zA-Z][a-zA-Z0-9]*;|&#\d+;/g, (m) => {
    if (m in ENTITIES) return ENTITIES[m];
    throw new Error(`scan-html: unknown entity ${m} — add it to ENTITIES and check search.js agrees`);
  });
}

// search.js strips `sup, .return`: footnote markers and the § return links. <mark> is kept — it wraps
// ordinary body text — and <mark title> tooltips are attribute text, which textContent never sees.
// \breturn\b would also strip class="no-return"; .return is a whitespace-separated token match.
const RETURN_CLASS = String.raw`class="(?:[^"]*\s)?return(?:\s[^"]*)?"`;
const STRIP_ELEMENTS = new RegExp(String.raw`<sup\b[^>]*>[\s\S]*?</sup>|<a\b[^>]*\s${RETURN_CLASS}[^>]*>[\s\S]*?</a>`, 'gi');
// search.js's PAD_SELECTOR: textContent joins nodes with nothing between them, so "world.</li><li>My"
// would fuse. Padding both sides of every such tag is equivalent once whitespace is collapsed.
const PAD_TAGS = /<\/?(?:br|li|p)\b[^>]*>/gi;

// Entities are decoded last: &lt; and &gt; would otherwise look like tags to the tag stripper.
export function stripTags(html) {
  return decodeEntities(
    html.replace(STRIP_ELEMENTS, '')
        .replace(PAD_TAGS, ' $& ')
        .replace(/<[^>]+>/g, '')
  );
}

// The block elements that appear as direct children of a Book section. This list is not an allowlist
// to be trusted on sight: anything missing from it lands in scanBooks()'s residue and throws, so a Book
// that grows a <table> or a <div> wrapper stops the build instead of quietly losing or re-splitting text.
const CHILD_TAGS = ['h2', 'h3', 'p', 'ul', 'ol', 'blockquote'];

// Yields [outerHtml, tagName, start, end] for each top-level element of `html` built from `tags`; the
// offsets let the caller account for the bytes in between. Depth is tracked so
// nesting cannot cut an element short: entry 12.24 carries <ol><li><ol>, where a non-greedy
// /<ol>[\s\S]*?<\/ol>/ ends the outer list at the inner list's close and loses 470 characters of it.
function* topLevelElements(html, tags) {
  const token = new RegExp(`<(/?)(${tags.join('|')})\\b[^>]*>`, 'gi');
  let depth = 0;
  let start = 0;
  let name = '';
  for (const m of html.matchAll(token)) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (depth === 0) {
      if (closing) throw new Error(`scan-html: unexpected </${tag}> outside any element`);
      name = tag;
      start = m.index;
      depth = 1;
    } else if (tag === name) {
      depth += closing ? -1 : 1;
      if (depth === 0) yield [html.slice(start, m.index + m[0].length), name, start, m.index + m[0].length];
    }
  }
  if (depth !== 0) throw new Error(`scan-html: unclosed <${name}>`);
}

// These require `id` to be the first attribute, as it is throughout the page. A hand edit that reorders
// one drops the entry, which Task 2's EXPECTED_ENTRIES === 499 check catches.
const BOOK_SECTION = /<section id="(book\d+)"[^>]*>/g;
const H3_ID = /^<h3 id="(book\d+-\d+[a-z]?)"/;
const STRONG_ID = /<strong id="(book\d+-\d+[a-z]?)"/;

// Body of the <section> that starts at `open`, found by counting to its own close tag rather than
// stopping at the first </section>, which would be an inner one if Book sections ever came to nest.
function sectionBody(html, open) {
  const from = open.index + open[0].length;
  const token = /<section\b[^>]*>|<\/section>/g;
  token.lastIndex = from;
  let depth = 1;
  for (let m; (m = token.exec(html));) {
    depth += m[0] === '</section>' ? -1 : 1;
    if (depth === 0) return html.slice(from, m.index);
  }
  throw new Error(`scan-html: unclosed <section id="${open[1]}">`);
}

// buildIndex() selects `main > section[id]`, so a Book section outside <main> is not on the page's
// index either. Scoping here keeps the two corpora the same if the page ever grows one.
function mainContent(html) {
  const open = /<main\b[^>]*>/.exec(html);
  const close = html.indexOf('</main>');
  if (!open || close < 0) throw new Error('scan-html: no <main> element to read the Books from');
  return html.slice(open.index + open[0].length, close);
}

// One item per direct child of a <section id="bookN">, in document order. Mirrors buildIndex():
// <h2> is skipped, everything else contributes its visible text, and only Book sections are read.
export function scanBooks(html) {
  const main = mainContent(html);
  const items = [];
  for (const open of main.matchAll(BOOK_SECTION)) {
    const body = sectionBody(main, open);
    // Everything in a Book section must be inside an indexed child. Whatever falls between them — an
    // unknown element, a wrapper whose children would be promoted to top level, stray text — is
    // collected and throws. A marker lost this way is caught downstream by the 499 count; body text
    // lost or re-split is not, and that is what an agent would end up quoting wrongly.
    let cursor = 0;
    let residue = '';
    for (const [child, tag, start, end] of topLevelElements(body, CHILD_TAGS)) {
      residue += body.slice(cursor, start);
      cursor = end;
      if (tag === 'h2') continue;
      const h3 = H3_ID.exec(child);
      const strong = h3 ? null : STRONG_ID.exec(child);
      items.push({
        marker: h3 ? h3[1] : strong ? strong[1] : null,
        text: normalizeText(stripTags(child)),
      });
    }
    residue += body.slice(cursor);
    if (residue.trim()) {
      throw new Error(`scan-html: unindexed markup in ${open[1]}: ${normalizeText(residue).slice(0, 60)}`);
    }
  }
  return items;
}
