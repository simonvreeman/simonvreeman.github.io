import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHtml } from '../lib/render-html.mjs';

const doc = {
  version: '1.0', schema: 'https://entitymap.org/spec/v1.0',
  publisher: { name: 'Vreeman.com', url: 'https://vreeman.com/' },
  generated: '2026-06-18T00:00:00Z',
  entities: [{ entityId: 'concept-stoicism', '@type': 'Concept', name: 'Stoicism', description: 'A philosophy.',
    hasChunks: [{ chunkId: 'c1', text: 'Stoicism is a school.', sourceUrl: 'https://vreeman.com/meditations/', pageTitle: 'Meditations', publisher: 'Vreeman.com' }] }],
};

test('renders valid standalone HTML with plain-text attribution', () => {
  const html = renderHtml(doc);
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /Vreeman\.com/);
  assert.match(html, /Stoicism/);
  assert.match(html, /https:\/\/vreeman\.com\/meditations\//);
  assert.match(html, /<script type="application\/ld\+json">/);            // spec §9 item #2
  assert.doesNotMatch(html, /<script(?![^>]*type="application\/ld\+json")/i); // no executable scripts
});

test('embeds per-entity JSON-LD mapped to schema.org', () => {
  const html = renderHtml(doc);
  assert.match(html, /"@context":"https:\/\/schema\.org"/);
  assert.match(html, /"@type":"DefinedTerm"/); // Concept -> DefinedTerm
  assert.doesNotMatch(html, /<\/script>\s*<\/script>/); // no broken/empty doubled tags
});

test('escapes HTML special characters in entity text', () => {
  const d = { ...doc, entities: [{ ...doc.entities[0], name: 'A & B <x>', description: 'x', hasChunks: doc.entities[0].hasChunks }] };
  const html = renderHtml(d);
  assert.match(html, /A &amp; B &lt;x&gt;/);
});
