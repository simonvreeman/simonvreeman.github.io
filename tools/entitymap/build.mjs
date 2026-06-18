import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION, SCHEMA_URI } from './lib/constants.mjs';
import { publisher } from './data/publisher.mjs';
import { vocabulary } from './data/vocabulary.mjs';
import { concepts } from './data/concepts.mjs';
import { persons } from './data/persons.mjs';
import { works } from './data/works.mjs';
import { bootstrapLetters } from './lib/bootstrap-letters.mjs';
import { validate } from './lib/validate.mjs';
import { renderHtml } from './lib/render-html.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function buildDoc(now = new Date().toISOString()) {
  const entities = [
    ...concepts,
    ...persons,
    ...works,
    ...bootstrapLetters(path.join(REPO_ROOT, 'seneca')),
  ];
  return {
    version: VERSION,
    schema: SCHEMA_URI,
    publisher,
    generated: now,
    profile: 'core',
    verificationStatus: 'self-declared',
    vocabulary,
    entities,
  };
}

function main() {
  const doc = buildDoc();
  const { errors, warnings } = validate(doc);
  for (const w of warnings) console.warn(`WARN  ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`ERROR ${e}`);
    console.error(`\n${errors.length} error(s) — not writing.`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(REPO_ROOT, 'entitymap.json'), JSON.stringify(doc, null, 2) + '\n');
  fs.writeFileSync(path.join(REPO_ROOT, 'entitymap.html'), renderHtml(doc));
  console.log(`OK  ${doc.entities.length} entities → entitymap.json + entitymap.html`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
