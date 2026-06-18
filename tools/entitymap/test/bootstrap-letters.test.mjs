import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTags, firstSentencesWithin } from '../lib/text.mjs';
import { bootstrapLetters } from '../lib/bootstrap-letters.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test('stripTags removes markup and decodes entities', () => {
  assert.equal(stripTags('<p>Greet&nbsp;&amp; go</p>'), 'Greet & go');
});

test('firstSentencesWithin never exceeds the limit and breaks on a sentence', () => {
  const s = 'One sentence here. A second much longer sentence that would blow the budget entirely.';
  const out = firstSentencesWithin(s, 30);
  assert.ok(out.length <= 30);
  assert.ok(s.startsWith(out)); // verbatim prefix
});

test('bootstrapLetters reads real letter files and yields conformant entities', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const letters = bootstrapLetters(path.join(repoRoot, 'seneca'));
  assert.ok(letters.length >= 60, `expected ~68 letters, got ${letters.length}`);
  for (const e of letters) {
    assert.match(e.entityId, /^seneca-letter-\d+$/);
    assert.equal(e['@type'].endsWith('#Work'), true);
    assert.equal(e.hasChunks.length, 1);
    assert.ok([...e.hasChunks[0].text].length <= 600);
    assert.equal(e.hasChunks[0].publisher, 'Vreeman.com');
  }
  assert.equal(letters.some((e) => e.entityId === 'seneca-letter-'), false);
});

test('letter names are cleaned (no emoji prefix or " - Seneca" suffix)', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const letters = bootstrapLetters(path.join(repoRoot, 'seneca'));
  const l1 = letters.find((e) => e.entityId === 'seneca-letter-1');
  assert.ok(l1, 'letter 1 should exist');
  assert.match(l1.name, /^Letter 1: On Saving Time/);
  assert.doesNotMatch(l1.name, /[-–—]\s*Seneca\s*$/);
  assert.doesNotMatch(l1.name, /^[^\p{L}\p{N}]/u); // no leading emoji/symbol
  assert.match(l1.description, /"On Saving Time"/);
});
