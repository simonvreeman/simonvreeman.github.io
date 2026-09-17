// Generates meditations/entries.json — the corpus the MCP server searches, and a
// machine-readable edition of the Books in its own right.
//
//   node tools/meditations-search/build-index.mjs
//
// Grouping, labels and quote folding come from meditations/search.js so the corpus
// cannot drift from what readers search in the browser.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanBooks } from './lib/scan-html.mjs';
import { groupEntries } from '../../meditations/search.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_PATH = 'meditations/index.html';
const OUTPUT_PATH = 'meditations/entries.json';
const EXPECTED_ENTRIES = 499;

export function buildEntries(html) {
  // `lower` is derivable from `text`; shipping it would nearly double the file for nothing. A consumer
  // that wants to search puts it back with withLower() from meditations/search.js.
  return groupEntries(scanBooks(html)).map(({ id, label, text }) => ({ id, label, text }));
}

// One entry per line: 0.2% larger than a fully compact dump, and it makes a reworded entry a one-line
// `git diff` instead of a single 210 KB line. JSON.stringify(x, null, 2) would cost 6% for no more
// reviewability, since an entry is three short fields. Internal: index.test.mjs checks the shipped
// bytes directly, which is a stronger guard than calling this would be.
function serialize(entries) {
  return `[\n${entries.map(e => JSON.stringify(e)).join(',\n')}\n]\n`;
}

function main() {
  const html = fs.readFileSync(path.join(REPO_ROOT, SOURCE_PATH), 'utf8');
  const entries = buildEntries(html);
  if (entries.length !== EXPECTED_ENTRIES) {
    console.error(`ERROR expected ${EXPECTED_ENTRIES} entries, scanned ${entries.length} — check the Book markup.`);
    process.exit(1);
  }
  const out = path.join(REPO_ROOT, OUTPUT_PATH);
  fs.writeFileSync(out, serialize(entries));
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`OK  ${entries.length} entries → ${OUTPUT_PATH} (${kb} KB)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
