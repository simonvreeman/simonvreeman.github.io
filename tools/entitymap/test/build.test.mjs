import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDoc } from '../build.mjs';
import { validate } from '../lib/validate.mjs';

test('assembled document validates with zero errors', () => {
  const doc = buildDoc();
  const { errors } = validate(doc);
  assert.deepEqual(errors, [], errors.join('\n'));
});
test('document has the expected shape and scale', () => {
  const doc = buildDoc();
  assert.equal(doc.version, '1.0');
  assert.ok(doc.entities.length >= 90, `expected ~100+ entities, got ${doc.entities.length}`);
  assert.ok(doc.entities.length < 200, 'still under the sharding threshold');
  for (const e of doc.entities) for (const c of e.hasChunks) {
    assert.ok([...c.text].length <= 600);
    assert.equal(c.publisher, 'Vreeman.com');
  }
});
