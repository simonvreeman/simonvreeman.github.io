import test from 'node:test';
import assert from 'node:assert/strict';
import { entityToMarkdown } from '../lib/entity-to-markdown.mjs';
import { entityPath } from '../lib/paths.mjs';
import { WORK_TYPE } from '../../entitymap/data/vocabulary.mjs';

const idToPath = entityPath;
const now = '2026-06-19T00:00:00.000Z';

const concept = {
  entityId: 'concept-stoicism', '@type': 'Concept', name: 'Stoicism',
  description: 'The Hellenistic school founded by Zeno.',
  sameAs: ['https://www.wikidata.org/wiki/Q48235'],
  relations: [
    { predicate: 'INSTANCE_OF', targetId: 'concept-philosophy', targetName: 'Philosophy' },
    { predicate: 'DESCRIBED_BY', targetId: 'work-meditations', targetName: 'Meditations' },
  ],
  hasChunks: [{ chunkId: 'c1', text: 'The Stoic school takes its name from the stoa.', sourceUrl: 'https://vreeman.com/meditations/', pageTitle: 'Meditations', publisher: 'Vreeman.com', contentType: 'definition', relevanceScore: 0.95 }],
};

test('frontmatter has required non-empty type and maps Concept', () => {
  const md = entityToMarkdown(concept, now, idToPath);
  assert.match(md, /^---\ntype: Concept\n/);
  assert.match(md, /title: Stoicism/);
  assert.match(md, /resource: https:\/\/www\.wikidata\.org\/wiki\/Q48235/);
});
test('relations become linked prose with predicate verbs', () => {
  const md = entityToMarkdown(concept, now, idToPath);
  assert.match(md, /## Related/);
  assert.match(md, /An instance of \[Philosophy\]\(\.\/philosophy\.md\)\./);
  assert.match(md, /Described by \[Meditations\]\(\.\.\/works\/meditations\.md\)\./);
});
test('chunks become Examples blockquote + Citations', () => {
  const md = entityToMarkdown(concept, now, idToPath);
  assert.match(md, /## Examples\n\n> The Stoic school takes its name from the stoa\. \[1\]/);
  assert.match(md, /## Citations\n\n\[1\] \[Meditations\]\(https:\/\/vreeman\.com\/meditations\/\)/);
});
test('custom Work @type maps to bare "Work"', () => {
  const md = entityToMarkdown({ ...concept, '@type': WORK_TYPE, entityId: 'work-meditations', relations: [], sameAs: [] }, now, idToPath);
  assert.match(md, /^---\ntype: Work\n/);
});
