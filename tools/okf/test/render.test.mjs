import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDirIndex, renderRootIndex } from '../lib/render-index.mjs';
import { renderLog } from '../lib/render-log.mjs';

test('dir index lists entries, no frontmatter', () => {
  const md = renderDirIndex('Concepts', [{ file: 'stoicism.md', title: 'Stoicism', description: 'The school.' }]);
  assert.ok(!md.startsWith('---'));
  assert.match(md, /# Concepts/);
  assert.match(md, /\* \[Stoicism\]\(stoicism\.md\) - The school\./);
});
test('root index carries only okf_version and links sections', () => {
  const md = renderRootIndex([{ dir: 'concepts', title: 'Concepts', description: 'Core doctrines.' }]);
  assert.match(md, /^---\nokf_version: "0\.1"\n---/);
  assert.match(md, /\* \[Concepts\]\(concepts\/\) - Core doctrines\./);
});
test('log has an ISO date heading', () => {
  const md = renderLog('2026-06-19', 102);
  assert.match(md, /## 2026-06-19/);
  assert.match(md, /\*\*Initialization\*\*/);
  assert.match(md, /102/);
});
