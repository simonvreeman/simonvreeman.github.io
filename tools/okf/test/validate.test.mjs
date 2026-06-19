import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBundle } from '../lib/validate.mjs';

const ok = () => new Map([
  ['index.md', '---\nokf_version: "0.1"\n---\n# Bundle\n'],
  ['log.md', '# Log\n\n## 2026-06-19\n\n* **Initialization**: x\n'],
  ['concepts/index.md', '# Concepts\n\n* [X](x.md)\n'],
  ['concepts/stoicism.md', '---\ntype: Concept\ntitle: Stoicism\n---\n# Stoicism\n'],
]);

test('conformant bundle passes', () => {
  assert.deepEqual(validateBundle(ok()).errors, []);
});
test('concept without type fails', () => {
  const f = ok(); f.set('concepts/x.md', '---\ntitle: No Type\n---\n# x\n');
  assert.ok(validateBundle(f).errors.some(e => /type/.test(e)));
});
test('concept without frontmatter fails', () => {
  const f = ok(); f.set('concepts/x.md', '# just a heading\n');
  assert.ok(validateBundle(f).errors.some(e => /frontmatter/.test(e)));
});
test('sub-dir index.md with frontmatter fails', () => {
  const f = ok(); f.set('concepts/index.md', '---\ntype: Concept\n---\n# Concepts\n');
  assert.ok(validateBundle(f).errors.some(e => /index\.md must not contain frontmatter/.test(e)));
});
test('root index.md with non-okf_version key fails', () => {
  const f = ok(); f.set('index.md', '---\nokf_version: "0.1"\ntype: X\n---\n# Bundle\n');
  assert.ok(validateBundle(f).errors.some(e => /only carry okf_version/.test(e)));
});
