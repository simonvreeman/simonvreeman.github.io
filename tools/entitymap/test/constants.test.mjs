import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE_TYPES, STANDARD_PREDICATES, TIER3, INVERSE_PAIRS } from '../lib/constants.mjs';

test('16 core types incl. Guide', () => {
  assert.equal(CORE_TYPES.size, 16);
  assert.ok(CORE_TYPES.has('Concept'));
  assert.ok(CORE_TYPES.has('Guide'));
});

test('24 standard predicates; Tier 3 has 6', () => {
  assert.equal(STANDARD_PREDICATES.size, 24);
  assert.equal(TIER3.size, 6);
  assert.ok(TIER3.has('IMPROVES'));
});

test('inverse pairs include PART_OF/INCLUDES', () => {
  assert.ok(INVERSE_PAIRS.some(([a, b]) => a === 'PART_OF' && b === 'INCLUDES'));
});
