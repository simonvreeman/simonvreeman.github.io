import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { concepts } from '../entitymap/data/concepts.mjs';
import { persons } from '../entitymap/data/persons.mjs';
import { works } from '../entitymap/data/works.mjs';
import { bootstrapLetters } from '../entitymap/lib/bootstrap-letters.mjs';
import { entityPath, senecaLetterNumber } from './lib/paths.mjs';
import { entityToMarkdown } from './lib/entity-to-markdown.mjs';
import { renderDirIndex, renderRootIndex } from './lib/render-index.mjs';
import { renderLog } from './lib/render-log.mjs';
import { validateBundle } from './lib/validate.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OKF_DIR = path.join(REPO_ROOT, 'okf');

const SECTIONS = [
  { dir: 'concepts', title: 'Concepts', description: 'Core Stoic concepts and doctrines.' },
  { dir: 'persons', title: 'Persons', description: 'Philosophers, translators, and key figures.' },
  { dir: 'works', title: 'Works', description: 'Primary works, essays, and collections.' },
  { dir: 'seneca', title: "Seneca's Letters", description: "Seneca's Moral Letters to Lucilius." },
];

export function buildBundle(now = new Date().toISOString()) {
  const entities = [
    ...concepts, ...persons, ...works,
    ...bootstrapLetters(path.join(REPO_ROOT, 'seneca')),
  ];
  const files = new Map();

  // one concept doc per entity
  for (const e of entities) files.set(entityPath(e.entityId), entityToMarkdown(e, now, entityPath));

  // per-section index.md
  for (const s of SECTIONS) {
    let items = entities.filter(e => entityPath(e.entityId).startsWith(`${s.dir}/`));
    if (s.dir === 'seneca') items = items.slice().sort((a, b) => senecaLetterNumber(a.entityId) - senecaLetterNumber(b.entityId));
    const entriesList = items.map(e => ({
      file: entityPath(e.entityId).split('/').pop(),
      title: e.name,
      description: e.description,
    }));
    files.set(`${s.dir}/index.md`, renderDirIndex(s.title, entriesList));
  }

  files.set('index.md', renderRootIndex(SECTIONS));
  files.set('log.md', renderLog(now.slice(0, 10), entities.length));
  return files;
}

function main() {
  const files = buildBundle();
  const { errors } = validateBundle(files);
  if (errors.length) {
    for (const e of errors) console.error(`ERROR ${e}`);
    console.error(`\n${errors.length} error(s) — not writing.`);
    process.exit(1);
  }
  fs.rmSync(OKF_DIR, { recursive: true, force: true });
  for (const [rel, content] of files) {
    const abs = path.join(OKF_DIR, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content.endsWith('\n') ? content : `${content}\n`);
  }
  console.log(`OK  ${files.size} files → okf/`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
