import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../lib/validate.mjs';
import { WORK_TYPE, vocabulary } from '../data/vocabulary.mjs';

function validDoc(overrides = {}) {
  return {
    version: '1.0',
    schema: 'https://entitymap.org/spec/v1.0',
    publisher: { name: 'Vreeman.com', url: 'https://vreeman.com/' },
    generated: '2026-06-18T00:00:00Z',
    profile: 'core',
    verificationStatus: 'self-declared',
    vocabulary,
    entities: [
      {
        entityId: 'concept-stoicism',
        '@type': 'Concept',
        name: 'Stoicism',
        description: 'A Hellenistic philosophy.',
        hasChunks: [{
          chunkId: 'c1', text: 'Stoicism is a school of philosophy.',
          sourceUrl: 'https://vreeman.com/meditations/', pageTitle: 'Meditations',
          publisher: 'Vreeman.com', contentType: 'definition',
        }],
      },
    ],
    ...overrides,
  };
}

test('valid minimal doc has no errors', () => {
  assert.deepEqual(validate(validDoc()).errors, []);
});
test('missing root field errors', () => {
  const d = validDoc(); delete d.publisher;
  assert.ok(validate(d).errors.some((e) => /publisher/.test(e)));
});
test('wrong version errors', () => {
  assert.ok(validate(validDoc({ version: '0.9' })).errors.some((e) => /version/.test(e)));
});
test('entity missing description errors', () => {
  const d = validDoc(); delete d.entities[0].description;
  assert.ok(validate(d).errors.some((e) => /description/.test(e)));
});
test('unknown @type errors', () => {
  const d = validDoc(); d.entities[0]['@type'] = 'Widget';
  assert.ok(validate(d).errors.some((e) => /@type/.test(e)));
});
test('custom namespaced Work @type is allowed', () => {
  const d = validDoc(); d.entities[0]['@type'] = WORK_TYPE;
  assert.deepEqual(validate(d).errors, []);
});
test('duplicate entityId errors', () => {
  const d = validDoc(); d.entities.push({ ...d.entities[0] });
  assert.ok(validate(d).errors.some((e) => /duplicate/i.test(e)));
});
test('deprecated entity without replacedBy errors', () => {
  const d = validDoc(); d.entities[0].status = 'deprecated';
  assert.ok(validate(d).errors.some((e) => /replacedBy/.test(e)));
});
test('chunk over 600 chars errors', () => {
  const d = validDoc(); d.entities[0].hasChunks[0].text = 'x'.repeat(601);
  assert.ok(validate(d).errors.some((e) => /600/.test(e)));
});
test('chunk publisher mismatch errors', () => {
  const d = validDoc(); d.entities[0].hasChunks[0].publisher = 'vreeman.com';
  assert.ok(validate(d).errors.some((e) => /publisher.*match/i.test(e)));
});
test('bad contentType errors', () => {
  const d = validDoc(); d.entities[0].hasChunks[0].contentType = 'nonsense';
  assert.ok(validate(d).errors.some((e) => /contentType/.test(e)));
});
test('duplicate chunkId errors', () => {
  const d = validDoc();
  d.entities[0].hasChunks.push({ ...d.entities[0].hasChunks[0] });
  assert.ok(validate(d).errors.some((e) => /chunkId/.test(e)));
});
test('unknown predicate errors', () => {
  const d = validDoc();
  d.entities[0].relations = [{ predicate: 'FOO_BAR', targetName: 'X' }];
  assert.ok(validate(d).errors.some((e) => /predicate/.test(e)));
});
test('custom TRANSLATED_BY predicate allowed', () => {
  const d = validDoc();
  d.entities[0].relations = [{ predicate: 'TRANSLATED_BY', targetName: 'Gregory Hays' }];
  assert.deepEqual(validate(d).errors, []);
});
test('Tier-3 predicate without confidence errors', () => {
  const d = validDoc();
  d.entities[0].relations = [{ predicate: 'IMPROVES', targetName: 'Resilience' }];
  assert.ok(validate(d).errors.some((e) => /confidence/.test(e)));
});
test('COVERS from a non-Concept source errors', () => {
  const d = validDoc();
  d.entities[0]['@type'] = 'Person';
  d.entities[0].relations = [{ predicate: 'COVERS', targetName: 'X' }];
  assert.ok(validate(d).errors.some((e) => /COVERS/.test(e)));
});
test('targetId must resolve to an entity', () => {
  const d = validDoc();
  d.entities[0].relations = [{ predicate: 'RELATES_TO', targetId: 'ghost', targetName: 'Ghost' }];
  assert.ok(validate(d).errors.some((e) => /targetId/.test(e)));
});
test('declaring both PART_OF and INCLUDES between same pair errors', () => {
  const d = validDoc();
  d.entities.push({
    entityId: 'work-discourses', '@type': WORK_TYPE, name: 'Discourses', description: 'Lectures.',
    relations: [{ predicate: 'INCLUDES', targetId: 'concept-stoicism', targetName: 'Stoicism' }],
    hasChunks: [{ chunkId: 'c2', text: 'Discourses.', sourceUrl: 'https://vreeman.com/discourses/', pageTitle: 'Discourses', publisher: 'Vreeman.com' }],
  });
  d.entities[0].relations = [{ predicate: 'PART_OF', targetId: 'work-discourses', targetName: 'Discourses' }];
  assert.ok(validate(d).errors.some((e) => /inverse/i.test(e)));
});
test('relation missing targetName errors', () => {
  const d = validDoc();
  d.entities[0].relations = [{ predicate: 'RELATES_TO' }];
  assert.ok(validate(d).errors.some((e) => /targetName/.test(e)));
});
test('MEASURES from a non-Metric source errors', () => {
  const d = validDoc();
  d.entities[0].relations = [{ predicate: 'MEASURES', targetName: 'X' }];
  assert.ok(validate(d).errors.some((e) => /MEASURES/.test(e)));
});
test('AFFILIATED_WITH from a non-Person source errors', () => {
  const d = validDoc(); // concept-stoicism is a Concept, not a Person
  d.entities[0].relations = [{ predicate: 'AFFILIATED_WITH', targetName: 'X' }];
  assert.ok(validate(d).errors.some((e) => /AFFILIATED_WITH/.test(e)));
});
test('OFFERS from a non-Organization source errors', () => {
  const d = validDoc();
  d.entities[0].relations = [{ predicate: 'OFFERS', targetName: 'X' }];
  assert.ok(validate(d).errors.some((e) => /OFFERS/.test(e)));
});
test('OFFERS to a non-product target errors', () => {
  const d = validDoc();
  d.entities[0]['@type'] = 'Organization';
  d.entities.push({ entityId: 'concept-x', '@type': 'Concept', name: 'X', description: 'x',
    hasChunks: [{ chunkId: 'cx', text: 'x', sourceUrl: 'https://vreeman.com/x', pageTitle: 'X', publisher: 'Vreeman.com' }] });
  d.entities[0].relations = [{ predicate: 'OFFERS', targetId: 'concept-x', targetName: 'X' }];
  assert.ok(validate(d).errors.some((e) => /OFFERS/.test(e)));
});
test('relative sourceUrl errors', () => {
  const d = validDoc(); d.entities[0].hasChunks[0].sourceUrl = '/meditations/';
  assert.ok(validate(d).errors.some((e) => /sourceUrl/.test(e)));
});
test('relevanceScore out of range errors', () => {
  const d = validDoc(); d.entities[0].hasChunks[0].relevanceScore = 1.5;
  assert.ok(validate(d).errors.some((e) => /relevanceScore/.test(e)));
});
test('non-numeric relevanceScore errors', () => {
  const d = validDoc(); d.entities[0].hasChunks[0].relevanceScore = 'high';
  assert.ok(validate(d).errors.some((e) => /relevanceScore/.test(e)));
});
test('invalid generated timestamp errors', () => {
  assert.ok(validate(validDoc({ generated: 'June 18, 2026' })).errors.some((e) => /generated/.test(e)));
});
test('lowercase custom predicate errors', () => {
  const d = validDoc({ vocabulary: { predicates: ['translated_by'], namespace: 'https://vreeman.com/entitymap/vocab/v1' } });
  assert.ok(validate(d).errors.some((e) => /uppercase/.test(e)));
});
test('custom predicate colliding with a standard name errors', () => {
  const d = validDoc({ vocabulary: { predicates: ['COVERS'], namespace: 'https://vreeman.com/entitymap/vocab/v1' } });
  assert.ok(validate(d).errors.some((e) => /collides/.test(e)));
});
