import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from '../build-catalog.mjs';
import { buildDid } from '../build-did.mjs';
import { validate } from '../lib/validate.mjs';

const card = {
  title: 'Vreeman Site Search', version: '1.0.0',
  description: 'MCP server for vreeman.com — search tools and Stoic library.',
  tools: [{ name: 'search_content' }],
};

test('catalog from server-card is valid', () => {
  const c = buildCatalog(card, '2026-06-19T00:00:00.000Z');
  assert.equal(c.specVersion, '1.0');
  assert.equal(c.host.displayName, 'Vreeman.com');
  assert.equal(c.host.identifier, 'did:web:vreeman.com');
  assert.equal(c.entries.length, 2);
  assert.equal(c.entries[0].type, 'application/mcp-server+json');
  assert.equal(c.entries[0].url, 'https://vreeman.com/.well-known/mcp/server-card.json');
  assert.deepEqual(c.entries[0].capabilities, ['search_content']);
  assert.equal(c.entries[0].updatedAt, '2026-06-19T00:00:00.000Z');
  assert.deepEqual(validate(c).errors, []);
});

test('every entry carries both type and matching mediaType', () => {
  const c = buildCatalog(card, '2026-06-19T00:00:00.000Z');
  for (const e of c.entries) {
    assert.ok(e.type, 'entry has type');
    assert.equal(e.mediaType, e.type, 'mediaType mirrors type');
  }
});

test('OKF bundle is advertised as a discoverable entry', () => {
  const c = buildCatalog(card, '2026-06-19T00:00:00.000Z');
  const okf = c.entries.find((e) => e.identifier === 'urn:ai:vreeman.com:okf:stoicism');
  assert.ok(okf, 'OKF entry present');
  assert.equal(okf.type, 'application/okf-bundle+gzip');
  assert.equal(okf.url, 'https://vreeman.com/okf.tar.gz');
});
test('did doc resolves identity + advertises the catalog', () => {
  const d = buildDid();
  assert.equal(d.id, 'did:web:vreeman.com');
  assert.deepEqual(d.alsoKnownAs, ['https://vreeman.com/']);
  assert.equal(d.service[0].type, 'AICatalog');
  assert.equal(d.service[0].serviceEndpoint, 'https://vreeman.com/.well-known/ai-catalog.json');
});
