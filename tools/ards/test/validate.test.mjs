import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../lib/validate.mjs';

const good = () => ({
  specVersion: '1.0',
  host: { displayName: 'Vreeman.com', identifier: 'did:web:vreeman.com', trustManifest: { identity: 'did:web:vreeman.com', identityType: 'did' } },
  entries: [{ identifier: 'urn:ai:vreeman.com:mcp:site-search', displayName: 'X', type: 'application/mcp-server+json', url: 'https://vreeman.com/.well-known/mcp/server-card.json', representativeQueries: ['a', 'b'] }],
});

test('valid catalog passes', () => {
  assert.deepEqual(validate(good()).errors, []);
});
test('bad specVersion fails', () => {
  const d = good(); d.specVersion = '0.9';
  assert.ok(validate(d).errors.some(e => /specVersion/.test(e)));
});
test('empty entries fail', () => {
  const d = good(); d.entries = [];
  assert.ok(validate(d).errors.some(e => /entries/.test(e)));
});
test('bad URN fails', () => {
  const d = good(); d.entries[0].identifier = 'mcp-site-search';
  assert.ok(validate(d).errors.some(e => /urn:ai/.test(e)));
});
test('both url and data fails (exactly-one rule)', () => {
  const d = good(); d.entries[0].data = {};
  assert.ok(validate(d).errors.some(e => /exactly one/.test(e)));
});
test('neither url nor data fails', () => {
  const d = good(); delete d.entries[0].url;
  assert.ok(validate(d).errors.some(e => /exactly one/.test(e)));
});
test('trustManifest without identity fails', () => {
  const d = good(); d.host.trustManifest = {};
  assert.ok(validate(d).errors.some(e => /trustManifest.identity/.test(e)));
});
test('representativeQueries outside 2-5 warns, not errors', () => {
  const d = good(); d.entries[0].representativeQueries = ['only-one'];
  const { errors, warnings } = validate(d);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some(w => /representativeQueries/.test(w)));
});
