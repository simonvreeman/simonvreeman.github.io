import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from './build-catalog.mjs';
import { buildDid } from './build-did.mjs';
import { validate } from './lib/validate.mjs';
import { CATALOG_PATH, DID_PATH } from './lib/constants.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function main() {
  let card;
  try {
    card = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.well-known/mcp/server-card.json'), 'utf8'));
  } catch (err) {
    console.error(`ERROR could not read .well-known/mcp/server-card.json: ${err.message}`);
    process.exit(1);
  }
  const catalog = buildCatalog(card, new Date().toISOString());
  const { errors, warnings } = validate(catalog);
  for (const w of warnings) console.warn(`WARN  ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`ERROR ${e}`);
    console.error(`\n${errors.length} error(s) — not writing.`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(REPO_ROOT, CATALOG_PATH), JSON.stringify(catalog, null, 2) + '\n');
  fs.writeFileSync(path.join(REPO_ROOT, DID_PATH), JSON.stringify(buildDid(), null, 2) + '\n');
  const n = catalog.entries.length;
  console.log(`OK  ${n} ${n === 1 ? 'entry' : 'entries'} → ${CATALOG_PATH} + ${DID_PATH}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
