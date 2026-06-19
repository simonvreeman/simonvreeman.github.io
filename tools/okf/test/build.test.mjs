import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBundle } from '../build.mjs';
import { validateBundle } from '../lib/validate.mjs';

const files = buildBundle('2026-06-19T00:00:00.000Z');

test('bundle is conformant and complete', () => {
  assert.deepEqual(validateBundle(files).errors, []);
  assert.ok(files.has('index.md'));
  assert.ok(files.has('log.md'));
  assert.ok(files.has('concepts/index.md'));
  assert.ok(files.has('concepts/stoicism.md'));
  assert.ok(files.has('seneca/index.md'));
});
test('one file per entity (~100+)', () => {
  const concepts = [...files.keys()].filter(k => !k.endsWith('index.md') && k !== 'log.md');
  assert.ok(concepts.length >= 100, `expected >=100 concept files, got ${concepts.length}`);
});
