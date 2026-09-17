// Points every page's og:url at the canonical URL the page already declares.
//
//   node tools/og-url/build.mjs
//
// 81 pages shipped an og:url that disagreed with their own canonical: 76 with an empty string (the
// Seneca letters and three Stockdale essays, all from the same template) and 5 still carrying the
// utm_source=social tracking parameters. The empty ones are the worse half — a tagged URL at least
// resolves, while an empty string leaves a platform nothing to canonicalise against, so a crawler
// falls back to whatever URL it was handed, tracking parameters and all. Every share of a Seneca
// letter was affected.
//
// The repair is derived, never typed. Each page already carries a correct <link rel="canonical">,
// so og:url is copied from it and the two cannot disagree; a hand-edit pass over 81 files would
// reintroduce the same class of error it is fixing. tools/og-url/test/og-url.test.mjs then re-checks
// every shipped page, so this is a ratchet as much as a repair: the next page that copies the
// template and leaves og:url empty fails the suite instead of shipping.
//
// Pages come from `git ls-files`, so the sweep covers what the site actually publishes and nothing
// else — an untracked draft in the working tree is left to its author until they commit it, at
// which point the test names it and re-running this fixes it.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ORIGIN = 'https://vreeman.com';

// Deliberately strict: both patterns match a whole tag, not a prefix of one, and only in the exact
// form all 112 pages use. Regex over HTML is where this repo's bugs have lived — a non-greedy match
// silently truncated 477 characters from a generated entry earlier on this branch — and a lenient
// pattern fails in the dangerous direction, quietly rewriting a tag it did not really understand.
// Strict fails in the safe direction instead: a page that reorders these attributes, switches to
// single quotes or adds one is skipped rather than mangled, and the test's loose cross-check turns
// that skip into a red suite rather than a page that quietly never gets fixed.
export const CANONICAL = /<link rel="canonical" href="([^"]*)">/;
export const OG_URL = /<meta property="og:url" content="([^"]*)">/;

export const listPages = () =>
  execFileSync('git', ['-C', REPO_ROOT, 'ls-files', '-z', '--', '*.html'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .sort();

export const pagePath = page => path.join(REPO_ROOT, page);

export function readTags(html) {
  return { canonical: CANONICAL.exec(html)?.[1], ogUrl: OG_URL.exec(html)?.[1] };
}

// The URL a page at this path should be canonical for. Used only to flag a canonical that points
// somewhere other than its own page — this tool reports that, it does not overrule the canonical.
function selfUrl(page) {
  if (page === 'index.html') return `${ORIGIN}/`;
  if (page.endsWith('/index.html')) return `${ORIGIN}/${page.slice(0, -'index.html'.length)}`;
  return `${ORIGIN}/${page.slice(0, -'.html'.length)}`;
}

// A canonical that is empty, off-origin, or carries a query is not a URL worth copying: writing it
// into og:url would launder the exact defect this tool exists to remove. Such a page is skipped and
// named, never patched with a value the tool had to invent.
function unusable(canonical) {
  if (canonical === '') return 'its canonical is empty';
  if (/[?#]/.test(canonical)) return `its canonical carries a query or fragment — ${canonical}`;
  if (!canonical.startsWith(`${ORIGIN}/`)) return `its canonical is not an absolute ${ORIGIN} URL — ${canonical}`;
  return null;
}

// The value is written as raw attribute text, exactly as it was captured from the canonical's own
// attribute, so whatever escaping the source used is preserved byte for byte rather than decoded and
// re-encoded. A bare " or & reaching here means the capture was wrong, not that escaping is due.
export function rewrite(html, url) {
  if (/["&<>]/.test(url)) throw new Error(`${JSON.stringify(url)} is not safe to write as raw attribute text`);
  const found = html.match(new RegExp(OG_URL.source, 'g'))?.length ?? 0;
  if (found !== 1) throw new Error(`expected 1 og:url tag, found ${found}`);
  return html.replace(OG_URL, () => `<meta property="og:url" content="${url}">`);
}

export function planFixes() {
  const fixes = [];
  const skipped = [];
  const notes = [];
  const pages = listPages();

  for (const page of pages) {
    const { canonical, ogUrl } = readTags(fs.readFileSync(pagePath(page), 'utf8'));
    // No og:url to repair. Pages with a canonical and no og:url at all are a different defect,
    // reported by tools/og-url/test, and not one this tool invents a tag for.
    if (ogUrl === undefined) continue;
    if (canonical === undefined) {
      skipped.push(`${page}: no canonical to derive from`);
      continue;
    }
    const why = unusable(canonical);
    if (why) {
      skipped.push(`${page}: ${why}`);
      continue;
    }
    if (canonical !== selfUrl(page)) notes.push(`${page}: canonical points at ${canonical}, not ${selfUrl(page)}`);
    if (ogUrl !== canonical) fixes.push({ page, from: ogUrl, to: canonical });
  }

  return { pages, fixes, skipped, notes };
}

function main() {
  let plan;
  try {
    plan = planFixes();
  } catch (err) {
    console.error(`ERROR ${err.message}`);
    process.exit(1);
  }
  if (!plan.pages.length) {
    console.error('ERROR git ls-files listed no HTML pages — not writing.');
    process.exit(1);
  }

  try {
    for (const { page, from, to } of plan.fixes) {
      const file = pagePath(page);
      const html = fs.readFileSync(file, 'utf8');
      const next = rewrite(html, to);
      // The only edit is one attribute value, so the file must grow by exactly the difference
      // between the two. Any other delta means the pattern matched something other than the tag
      // that was read back, and the page is left untouched rather than written half-mangled.
      const delta = to.length - from.length;
      if (next.length - html.length !== delta) {
        throw new Error(`${page}: rewrite changed ${next.length - html.length} bytes, expected ${delta}`);
      }
      fs.writeFileSync(file, next);
    }
  } catch (err) {
    console.error(`ERROR ${err.message}`);
    process.exit(1);
  }

  for (const s of plan.skipped) console.log(`SKIP ${s}`);
  for (const n of plan.notes) console.log(`NOTE ${n}`);
  const n = plan.fixes.length;
  console.log(`OK  ${n} ${n === 1 ? 'page' : 'pages'} repointed at their canonical (${plan.pages.length} scanned)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
