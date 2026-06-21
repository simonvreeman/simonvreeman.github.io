import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { makeTarGz } from '../lib/targz.mjs';

test('produces a gzip stream with a valid ustar archive, entries sorted by name', () => {
  const gz = makeTarGz([
    { name: 'okf/index.md', content: 'hello' },
    { name: 'okf/a.md', content: 'x' },
  ]);
  assert.equal(gz[0], 0x1f); // gzip magic
  assert.equal(gz[1], 0x8b);
  const tar = zlib.gunzipSync(gz);
  // sorted → okf/a.md is the first header
  assert.match(tar.toString('utf8', 0, 8), /^okf\/a\.md/);
  assert.equal(tar.toString('ascii', 257, 262), 'ustar');
  // archive ends with two zero blocks
  assert.ok(tar.subarray(tar.length - 1024).every((b) => b === 0));
});

test('is deterministic for identical input', () => {
  const a = makeTarGz([{ name: 'okf/x.md', content: 'same' }]);
  const b = makeTarGz([{ name: 'okf/x.md', content: 'same' }]);
  assert.ok(a.equals(b));
});

test('rejects names too long for ustar', () => {
  assert.throws(() => makeTarGz([{ name: `okf/${'x'.repeat(110)}.md`, content: 'y' }]), /too long/);
});
