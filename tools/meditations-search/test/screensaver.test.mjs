import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPassages } from '../build-screensaver.mjs';
import passages from '../../../meditations/screensaver/passages.js';
import { PassageSequence, readingTime } from '../../../meditations/screensaver/screensaver.js';

test('shipped passages are exact curated highlights with valid references', () => {
  const html = fs.readFileSync(new URL('../../../meditations/index.html', import.meta.url), 'utf8');
  assert.deepEqual(passages, buildPassages(html));
  assert.equal(new Set(passages.map(p => p.text)).size, passages.length);
  for (const passage of passages) assert.ok(html.includes(`id="${passage.id}"`));
  // A mark in a continuation paragraph still belongs to the preceding entry.
  assert.equal(passages.find(p => p.text.startsWith('You boarded')).id, 'book3-3');
  assert.throws(() => buildPassages(html.replace('The things you think about determine', 'Changed source text determines')), /Expected one marked passage/);
});

test('shuffle completes each cycle and never repeats at the cycle boundary', () => {
  const items = ['a', 'b', 'c', 'd'];
  for (const random of [() => 0, () => .999, Math.random]) {
    const sequence = new PassageSequence(items, random);
    let last;
    for (let cycle = 0; cycle < 20; cycle++) {
      const round = items.map(() => sequence.next());
      assert.deepEqual([...round].sort(), items);
      assert.notEqual(round[0], last);
      last = round.at(-1);
    }
    assert.ok(sequence.history.length <= items.length * 2);
  }
});

test('previous/next revisits history without consuming new passages', () => {
  const sequence = new PassageSequence(passages);
  const first = sequence.next();
  assert.equal(sequence.previous(), first);
  assert.equal(sequence.previous(), first);
  const second = sequence.next();
  assert.notEqual(second, first);
  assert.equal(sequence.previous(), first);
  assert.equal(sequence.next(), second);
});

test('passages get at least a minute and longer passages get more time', () => {
  assert.equal(readingTime('A short thought.'), 60_000);
  assert.equal(readingTime(Array(100).fill('word').join(' ')), 90_000);
});
