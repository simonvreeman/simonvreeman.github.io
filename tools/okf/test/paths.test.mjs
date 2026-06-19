import test from 'node:test';
import assert from 'node:assert/strict';
import { entityPath, relLink } from '../lib/paths.mjs';

test('maps every id prefix', () => {
  assert.equal(entityPath('concept-stoicism'), 'concepts/stoicism.md');
  assert.equal(entityPath('person-seneca'), 'persons/seneca.md');
  assert.equal(entityPath('work-moral-letters'), 'works/moral-letters.md');
  assert.equal(entityPath('seneca-letter-12'), 'seneca/letter-12.md');
});
test('throws on unknown prefix', () => {
  assert.throws(() => entityPath('widget-x'));
});
test('relative link crosses directories', () => {
  assert.equal(relLink('concepts/stoicism.md', 'works/meditations.md'), '../works/meditations.md');
  assert.equal(relLink('concepts/stoicism.md', 'concepts/logos.md'), './logos.md');
});
