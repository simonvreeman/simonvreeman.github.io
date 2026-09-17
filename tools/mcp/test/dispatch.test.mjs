// dispatch() is the whole MCP server minus the HTTP envelope: give it a JSON-RPC message and an
// optional corpus loader and it answers. The loader is injected here so search_meditations can be
// tested without a network fetch — and, in the truncation test below, against the real 499 entries.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dispatch } from '../../../functions/mcp.js';

// Deliberately without `lower`, exactly as meditations/entries.json ships: dispatch() has to
// rehydrate it with withLower() or findMatches() throws on e.lower.
const CORPUS = [
  { id: 'book4-3', label: '4.3', text: 'People look for retreats for themselves, in the country, by the coast.' },
  { id: 'book2-1', label: '2.1', text: 'When you wake up in the morning, tell yourself.' },
];
const deps = { loadEntries: async () => CORPUS };
const call = (name, args, d = deps) =>
  dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, d);

test('tools/list offers both tools', async () => {
  const res = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, deps);
  assert.deepEqual(res.result.tools.map(t => t.name).sort(), ['search_content', 'search_meditations']);
});

test('search_meditations returns a deep link per hit', async () => {
  const res = await call('search_meditations', { query: 'retreats' });
  assert.equal(res.result.isError, false);
  assert.match(res.result.content[0].text, /4\.3/);
  assert.match(res.result.content[0].text, /https:\/\/vreeman\.com\/meditations\/#book4-3/);
});

test('search_meditations finds an entry by its number', async () => {
  const res = await call('search_meditations', { query: '2.1' });
  assert.match(res.result.content[0].text, /#book2-1/);
});

test('search_meditations reports no matches without erroring', async () => {
  const res = await call('search_meditations', { query: 'Farquharson' });
  assert.equal(res.result.isError, false);
  assert.match(res.result.content[0].text, /No entries match/);
});

test('search_meditations rejects an empty query', async () => {
  const res = await call('search_meditations', { query: '  ' });
  assert.equal(res.result.isError, true);
});

test('search_content still works', async () => {
  const res = await call('search_content', { query: 'utm' });
  assert.match(res.result.content[0].text, /vreeman\.com\/utm/);
});

test('an unknown tool is a JSON-RPC error', async () => {
  const res = await call('nope', { query: 'x' });
  assert.equal(res.error.code, -32602);
});

// --- the four verifications -----------------------------------------------

test('rehydrating the shared corpus twice is harmless', async () => {
  // The corpus is cached in module scope for the life of the isolate and withLower() mutates its
  // argument, so the second request in an isolate re-applies it to the very same objects. That is
  // safe because withLower() is idempotent (proved in meditations-search/test/index.test.mjs) and
  // synchronous, so no other request can observe a half-rehydrated array. Asserted here rather than
  // assumed, because it is why the loader hands out the cached array instead of copying it.
  const shared = [{ id: 'book7-9', label: '7.9', text: '7.9 years of war taught him nothing.' }];
  const load = async () => shared;
  const first = await call('search_meditations', { query: 'war' }, { loadEntries: load });
  const second = await call('search_meditations', { query: 'war' }, { loadEntries: load });
  assert.equal(second.result.content[0].text, first.result.content[0].text);
  // And nothing truncated the text: a second groupEntries() pass would have eaten the leading "7.9".
  assert.match(first.result.content[0].text, /7\.9 years of war/);
  assert.equal(shared[0].text, '7.9 years of war taught him nothing.');
});

test('a long result list is truncated, against the real 499-entry corpus', async () => {
  // A two-entry fixture can never reach MAX_RESULTS, so this one uses the shipped corpus. Copies,
  // so the on-disk parse stays exactly as parsed for the assertions below.
  const shipped = JSON.parse(readFileSync(new URL('../../../meditations/entries.json', import.meta.url), 'utf8'));
  const load = async () => shipped.map(e => ({ ...e }));
  const res = await call('search_meditations', { query: 'the' }, { loadEntries: load });
  const lines = res.result.content[0].text.split('\n');
  const total = Number(lines[0].match(/^(\d+) entries match/)[1]);
  assert.ok(total > 20, `"the" should match far more than 20 entries, got ${total}`);
  assert.match(lines[0], /\(showing the first 20\)/);
  assert.equal(lines.length - 1, 20, 'one head line plus exactly 20 results');
  for (const line of lines.slice(1)) assert.match(line, /^• \d+\.\d+[a-z]? — .+ — https:\/\/vreeman\.com\/meditations\/#book\d+-\d+[a-z]?$/);
});

test('a short result list carries no truncation notice', async () => {
  const res = await call('search_meditations', { query: 'retreats' });
  assert.match(res.result.content[0].text.split('\n')[0], /^1 entry matches "retreats":$/);
});

test('search_content is byte-for-byte what it was before search_meditations existed', async () => {
  const res = await call('search_content', { query: 'Invictus' });
  assert.equal(
    res.result.content[0].text,
    '1 result for "invictus":\n• Invictus — William Ernest Henley — https://vreeman.com/invictus'
  );
  assert.equal(res.result.isError, false);
});

test('search_content never touches the corpus loader', async () => {
  // Its CATALOG is in this file; a fetch of entries.json to answer it would be pure waste.
  let called = 0;
  const res = await call('search_content', { query: 'utm' }, { loadEntries: async () => { called++; return CORPUS; } });
  assert.equal(called, 0);
  assert.equal(res.result.isError, false);
});

test('the empty-query guard is the same for both tools', async () => {
  const a = await call('search_content', { query: '' });
  const b = await call('search_meditations', {});
  assert.equal(a.result.isError, true);
  assert.equal(b.result.isError, true);
  assert.equal(a.result.content[0].text, b.result.content[0].text);
  assert.match(a.result.content[0].text, /'query' argument is required/);
});

test('a corpus that will not load is a tool error, not a dead request', async () => {
  // dispatch() could not throw before it did I/O; now it can, and an unhandled rejection would be a
  // 500 with no JSON-RPC body at all. The client gets a tool error it can show instead.
  const res = await call('search_meditations', { query: 'retreats' }, {
    loadEntries: async () => { throw new Error('boom'); },
  });
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /could not be loaded/i);
});

test('initialize and ping are unchanged', async () => {
  const init = await dispatch({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.equal(init.result.serverInfo.name, 'com.vreeman/site-search');
  const ping = await dispatch({ jsonrpc: '2.0', id: 2, method: 'ping' });
  assert.deepEqual(ping.result, {});
  const bad = await dispatch({ jsonrpc: '2.0', id: 3, method: 'nope' });
  assert.equal(bad.error.code, -32601);
});

test('both tools take a required query, and the new one is declared read-only', async () => {
  const res = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  for (const t of res.result.tools) assert.deepEqual(t.inputSchema.required, ['query'], `${t.name} requires a query`);
  // Only the new tool: adding annotations to search_content would change a payload this task is
  // meant to leave alone. Worth doing, but not here.
  const med = res.result.tools.find(t => t.name === 'search_meditations');
  assert.equal(med.annotations.readOnlyHint, true);
});

test('every example query in the tool description actually matches something', async () => {
  // An agent copies these verbatim. The plan's original example, 'retreats for themselves', is Long's
  // wording; this edition is Hays, where 4.3 reads 'get away from it all' — it would have returned
  // nothing. Checked against the shipped corpus so a retranslation cannot quietly falsify the schema.
  const shipped = JSON.parse(readFileSync(new URL('../../../meditations/entries.json', import.meta.url), 'utf8'));
  const load = async () => shipped.map(e => ({ ...e }));
  const res = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const med = res.result.tools.find(t => t.name === 'search_meditations');
  const examples = [...med.inputSchema.properties.query.description.matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.ok(examples.length >= 2, 'the description should carry examples to check');
  for (const q of examples) {
    const hit = await call('search_meditations', { query: q }, { loadEntries: load });
    assert.doesNotMatch(hit.result.content[0].text, /^No entries match/, `example ${JSON.stringify(q)} finds nothing`);
  }
});
