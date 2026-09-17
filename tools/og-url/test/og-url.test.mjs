// Every page that declares both a canonical and an og:url must agree on the URL.
//
// An empty og:url is the worse half of this: a tagged one at least resolves, while an empty string
// gives a platform nothing to canonicalise against, so a crawler falls back to whatever URL it was
// handed — including the tracking parameters a sharer appended. 81 pages shipped one or the other
// before this guard existed. The point of the test is less the repair than the ratchet: the next
// page that copies the template and forgets to fill og:url in fails here instead of in production.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CANONICAL, OG_URL, listPages, pagePath, planFixes, readTags, rewrite } from '../build.mjs';

const pages = listPages();

// A guard that scanned nothing would be green forever. The site has ~110 pages; the floor only has
// to be high enough that an empty or broken listing cannot pass for a clean sweep.
test('the sweep sees the whole site', () => {
  assert.ok(pages.length > 100, `only ${pages.length} pages listed`);
});

test('og:url matches the canonical on every page that has both', () => {
  // A bare assert.equal per file inside a loop stops at the first offender and hides the rest.
  // Collecting them means one run names every page that needs attention.
  const mismatches = [];
  for (const page of pages) {
    const { canonical, ogUrl } = readTags(readFileSync(pagePath(page), 'utf8'));
    if (canonical === undefined || ogUrl === undefined) continue;
    if (ogUrl !== canonical) mismatches.push(`${page}\n    canonical: ${JSON.stringify(canonical)}\n    og:url:    ${JSON.stringify(ogUrl)}`);
  }
  assert.deepEqual(mismatches, [], `${mismatches.length} page(s) disagree:\n  ${mismatches.join('\n  ')}`);
});

test('the generator has nothing left to do', () => {
  // The companion to the check above: it proves the shipped HTML is what build.mjs would write now,
  // so a green suite cannot mean "someone fixed the pages by hand and the generator has since
  // drifted". Mirrors the shipped-vs-generated check in tools/agent-skills/test/digest.test.mjs.
  assert.deepEqual(planFixes().fixes, []);
});

test('no page hides a second canonical or og:url behind the first', () => {
  // readTags() takes the first match of each. That is only safe while there is at most one of each
  // to take — a second tag lower down would silently win with some consumers and lose with others.
  const duplicates = [];
  for (const page of pages) {
    const html = readFileSync(pagePath(page), 'utf8');
    const canonicals = html.match(/<link[^>]*\brel=["']?canonical\b[^>]*>/gi) ?? [];
    const ogUrls = html.match(/<meta[^>]*\bog:url\b[^>]*>/gi) ?? [];
    if (canonicals.length > 1) duplicates.push(`${page}: ${canonicals.length} canonical tags`);
    if (ogUrls.length > 1) duplicates.push(`${page}: ${ogUrls.length} og:url tags`);
  }
  assert.deepEqual(duplicates, []);
});

test('the strict patterns match every canonical and og:url tag that exists', () => {
  // The generator only rewrites tags its narrow pattern recognises. If a page ever writes
  // rel=canonical unquoted, reorders the attributes or switches to single quotes, the loose scan
  // above still finds the tag while CANONICAL/OG_URL skip it — and the page would be waved through
  // as "has no og:url" rather than fixed. That silent skip is the failure this catches.
  const unparsed = [];
  for (const page of pages) {
    const html = readFileSync(pagePath(page), 'utf8');
    const { canonical, ogUrl } = readTags(html);
    if (/<link[^>]*\brel=["']?canonical\b/i.test(html) && canonical === undefined) unparsed.push(`${page}: canonical tag not matched by ${CANONICAL}`);
    if (/<meta[^>]*\bog:url\b/i.test(html) && ogUrl === undefined) unparsed.push(`${page}: og:url tag not matched by ${OG_URL}`);
  }
  assert.deepEqual(unparsed, []);
});

test('no page derives its og:url from an unusable canonical', () => {
  // Writing an empty or tagged og:url is the bug being fixed, so deriving one from an empty or
  // tagged canonical would just launder it. A canonical that points somewhere other than its own
  // page is a separate defect that build.mjs reports as a NOTE and deliberately does not overrule:
  // seneca/letter-124.html is an unfilled copy of the template whose canonical, title and headings
  // all still read "letter-" — a page to finish or delete, not one to paper over here.
  const unusable = [];
  for (const page of pages) {
    const { canonical, ogUrl } = readTags(readFileSync(pagePath(page), 'utf8'));
    if (ogUrl === undefined || canonical === undefined) continue;
    if (canonical === '') unusable.push(`${page}: empty canonical`);
    else if (/[?#]/.test(canonical)) unusable.push(`${page}: canonical carries a query or fragment — ${canonical}`);
    else if (!canonical.startsWith('https://vreeman.com/')) unusable.push(`${page}: canonical is not an absolute vreeman.com URL — ${canonical}`);
  }
  assert.deepEqual(unusable, []);
});

// --- the rewrite itself, on markup chosen to break it -------------------------------------------

const page = body => `<head>\n<link rel="canonical" href="https://vreeman.com/x">\n${body}\n</head>`;

test('rewriting touches only the content of the og:url tag', () => {
  const before = page('<meta property="og:title" content="">\n<meta property="og:url" content="">\n<meta property="og:image" content="">');
  const after = rewrite(before, 'https://vreeman.com/x');
  assert.equal(after, before.replace('property="og:url" content=""', 'property="og:url" content="https://vreeman.com/x"'));
  // Every other line survives byte for byte, including the two empty siblings either side.
  assert.equal(after.split('\n').filter((l, i) => l !== before.split('\n')[i]).length, 1);
});

test('rewriting replaces a tagged value, not just an empty one', () => {
  const before = page('<meta property="og:url" content="https://vreeman.com/x?utm_source=social">');
  assert.equal(rewrite(before, 'https://vreeman.com/x'), page('<meta property="og:url" content="https://vreeman.com/x">'));
});

test('rewriting leaves a same-named property on another tag alone', () => {
  // og:image:secure_url and books:isbn sit next to og:url in this template, and a JSON-LD "url"
  // key elsewhere in the page must not be caught either.
  const before = page('<meta property="og:image:secure_url" content="">\n<meta property="og:url" content="">\n<script type="application/ld+json">{"url":""}</script>');
  const after = rewrite(before, 'https://vreeman.com/x');
  assert.match(after, /og:image:secure_url" content=""/);
  assert.match(after, /\{"url":""\}/);
  assert.match(after, /og:url" content="https:\/\/vreeman\.com\/x"/);
});

test('rewriting refuses a value that would need escaping', () => {
  // The canonical is copied as raw attribute text, so it is already escaped the way the source
  // escaped it. A bare " or & would mean the capture was wrong, not that escaping is needed.
  assert.throws(() => rewrite(page('<meta property="og:url" content="">'), 'https://vreeman.com/a"b'), /not safe/);
  assert.throws(() => rewrite(page('<meta property="og:url" content="">'), 'https://vreeman.com/a&b'), /not safe/);
});

test('rewriting refuses markup it cannot place exactly once', () => {
  assert.throws(() => rewrite(page('<meta property="og:title" content="">'), 'https://vreeman.com/x'), /1 og:url tag, found 0/);
  assert.throws(() => rewrite(page('<meta property="og:url" content="">\n<meta property="og:url" content="">'), 'https://vreeman.com/x'), /1 og:url tag, found 2/);
});
