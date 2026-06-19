import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, serializeFrontmatter } from '../lib/frontmatter.mjs';

test('round-trips a simple block', () => {
  const md = serializeFrontmatter({ type: 'Concept', title: 'Stoicism' });
  assert.ok(md.startsWith('---\n'));
  const fm = parseFrontmatter(md + '\n# body');
  assert.equal(fm.type, 'Concept');
  assert.equal(fm.title, 'Stoicism');
});
test('quotes values containing colons', () => {
  const md = serializeFrontmatter({ type: 'Work', title: 'Letter 1: On Saving Time' });
  assert.ok(md.includes('"Letter 1: On Saving Time"'));
});
test('returns null when no frontmatter', () => {
  assert.equal(parseFrontmatter('# just a heading'), null);
});
test('omits empty/absent fields', () => {
  const md = serializeFrontmatter({ type: 'Person', title: 'Seneca', resource: undefined });
  assert.ok(!md.includes('resource'));
});
