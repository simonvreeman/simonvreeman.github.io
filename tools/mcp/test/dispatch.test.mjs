// dispatch() is the whole MCP server minus the HTTP envelope: give it a JSON-RPC message and an
// optional corpus loader and it answers. The loader is injected here so search_meditations can be
// tested without a network fetch — and, in the truncation test below, against the real 499 entries.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dispatch, onRequestPost } from '../../../functions/mcp.js';

// Deliberately without `lower`, exactly as meditations/entries.json ships: dispatch() has to
// rehydrate it with withLower() or findMatches() throws on e.lower.
const CORPUS = [
  { id: 'book4-3', label: '4.3', text: 'People look for retreats for themselves, in the country, by the coast.' },
  { id: 'book2-1', label: '2.1', text: 'When you wake up in the morning, tell yourself.' },
];
const deps = { loadEntries: async () => CORPUS };
const call = (name, args, d = deps) =>
  dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, d);
// No deps at all, so the module's own fetch-and-cache loader runs. Used by exactly one test below.
const callDefault = (query) =>
  dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_meditations', arguments: { query } } });

// Copies, so the on-disk parse is never mutated by withLower() inside dispatch().
const shipped = JSON.parse(readFileSync(new URL('../../../meditations/entries.json', import.meta.url), 'utf8'));
const realCorpus = { loadEntries: async () => shipped.map(e => ({ ...e })) };

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
  // A two-entry fixture can never reach MAX_RESULTS, so this one uses the shipped corpus.
  const res = await call('search_meditations', { query: 'the' }, realCorpus);
  const lines = res.result.content[0].text.split('\n');
  const total = Number(lines[0].match(/^(\d+) entries match/)[1]);
  assert.ok(total > 20, `"the" should match far more than 20 entries, got ${total}`);
  // Says what to do about it: paging would mean re-fetching and re-matching per page on a stateless
  // endpoint, and the honest fix to a 434-hit query is a better query.
  assert.match(lines[0], /\(trans\. Hays; showing the first 20 — refine the query for fewer\):$/);
  assert.equal(lines.length - 1, 20, 'one head line plus exactly 20 results');
  for (const line of lines.slice(1)) assert.match(line, /^• \d+\.\d+[a-z]? — .+ — https:\/\/vreeman\.com\/meditations\/#book\d+-\d+[a-z]?$/);
});

test('a short result list carries no truncation notice, and names the edition', async () => {
  const res = await call('search_meditations', { query: 'retreats' });
  // (trans. Hays) costs ~8 tokens per call and is what makes a quotation citable; the tool
  // description says it too, but an agent may not carry that into its answer.
  assert.match(res.result.content[0].text.split('\n')[0], /^1 entry matches "retreats" \(trans\. Hays\):$/);
});

test('a plural, untruncated result list reads correctly', async () => {
  // Every fixture case is n=1 and the only n>1 case is truncated, so nothing else pins this head.
  const res = await call('search_meditations', { query: 'Verus' }, realCorpus);
  const lines = res.result.content[0].text.split('\n');
  assert.equal(lines[0], '5 entries match "verus" (trans. Hays):');
  assert.equal(lines.length - 1, 5);
  assert.doesNotMatch(lines[0], /showing the first/);
});

test('an exact entry number returns the whole entry, not a 140-character window', async () => {
  // findMatches() matches 4.3 on its label, but the leading "§ 4.3" is stripped at build time, so
  // snippet() finds no occurrence and falls back to the opening ~140 characters — leaving an agent
  // told to "quote a specific entry" with 145 of 2,378 characters and no recourse but the 210 KB file.
  const res = await call('search_meditations', { query: '4.3' }, realCorpus);
  const entry = shipped.find(e => e.id === 'book4-3');
  assert.ok(entry.text.length > 2000, 'this entry is long enough for the difference to matter');
  const line = res.result.content[0].text.split('\n')[1];
  // Equality with the shipped text is the real proof nothing was elided. Do not assert the absence
  // of an ellipsis here: Hays writes one into 4.3 itself for a lacuna ("ward off all < … >"), so the
  // full entry legitimately contains the same character the snippet builder uses for a cut.
  assert.equal(line, `• 4.3 — ${entry.text} — https://vreeman.com/meditations/#book4-3`);
  assert.ok(line.length > 2000, 'a snippet would have been ~145 characters');
});

test('a phrase query still gets a snippet, not the whole entry', async () => {
  // The full-text branch is for exact labels only; a word inside 4.3 must not dump 2,378 characters.
  const res = await call('search_meditations', { query: 'get away from it all' }, realCorpus);
  const line = res.result.content[0].text.split('\n')[1];
  assert.ok(line.length < 400, `snippet expected, got ${line.length} characters`);
  assert.match(line, /… — https:\/\/vreeman\.com\/meditations\/#book4-3$/, 'cut, then the deep link');
});

test('a query under MIN_QUERY says so instead of reporting a false negative', async () => {
  // findMatches() returns nothing below 2 characters without consulting the corpus, so "no entries
  // match" would be a lie an agent has no way to catch.
  const res = await call('search_meditations', { query: 'I' }, realCorpus);
  assert.equal(res.result.isError, false);
  assert.doesNotMatch(res.result.content[0].text, /No entries match/);
  assert.match(res.result.content[0].text, /at least 2 characters/);
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

test('initialize negotiates the version and advertises both tools; ping still answers', async () => {
  const init = await dispatch({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.equal(init.result.serverInfo.name, 'com.vreeman/site-search');
  // `instructions` did change — an initialize still advertising only search_content would be the
  // worse bug — so it is asserted rather than left to the test name to misdescribe.
  assert.match(init.result.instructions, /search_content/);
  assert.match(init.result.instructions, /search_meditations/);
  const ping = await dispatch({ jsonrpc: '2.0', id: 2, method: 'ping' });
  // An EmptyResult is no longer literally empty: 2026-07-28 requires resultType on every result.
  assert.deepEqual(ping.result, { resultType: 'complete' });
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
  const res = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const med = res.result.tools.find(t => t.name === 'search_meditations');
  const examples = [...med.inputSchema.properties.query.description.matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.ok(examples.length >= 2, 'the description should carry examples to check');
  for (const q of examples) {
    const hit = await call('search_meditations', { query: q }, realCorpus);
    assert.doesNotMatch(hit.result.content[0].text, /^No entries match/, `example ${JSON.stringify(q)} finds nothing`);
  }
});

test('a failed load does not poison the isolate for its whole life', async (t) => {
  // The ONE test in this file that exercises the default loader. `entriesPromise` is module-scoped
  // and there is no way to reset it from outside, so only a single fetch-stub test can run per
  // process: a second would silently inherit whatever this one left cached, and its stub would feed
  // this one's cache. Every other test injects deps.loadEntries instead. DO NOT ADD ANOTHER.
  const real = globalThis.fetch;
  t.after(() => { globalThis.fetch = real; });
  let n = 0;
  globalThis.fetch = async () => { n++; throw new Error('network down'); };
  assert.equal((await callDefault('retreats')).result.isError, true, 'a rejected fetch');
  // fetch() does not reject on a 404 — Pages answers one with its HTML error page — so this retries
  // only because the loader checks r.ok inside the chain, where the .catch can clear the cache.
  globalThis.fetch = async () => { n++; return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }; };
  assert.equal((await callDefault('retreats')).result.isError, true, 'a 404');
  globalThis.fetch = async () => { n++; return { ok: true, json: async () => ({ error: 'nope' }) }; };
  assert.equal((await callDefault('retreats')).result.isError, true, '200 carrying something that is not a corpus');
  globalThis.fetch = async () => { n++; return { ok: true, json: async () => CORPUS }; };
  assert.equal((await callDefault('retreats')).result.isError, false, 'no failure may still be cached');
  // Now served from module scope: this stub throws if the loader fetches again.
  globalThis.fetch = async () => { n++; throw new Error('should not be called'); };
  assert.equal((await callDefault('retreats')).result.isError, false);
  assert.equal(n, 4, 'four loads attempted, then the cache takes over');
});

// --- MCP 2026-07-28, served alongside the legacy handshake -----------------
// The shapes below are taken from the published schema, not from prose:
// https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/2026-07-28/schema.ts
// DiscoverResult extends CacheableResult extends Result, so a conforming result carries
// `resultType`, `ttlMs` and `cacheScope`, names its versions in `supportedVersions` (plural, an
// array — there is no `protocolVersion` field on it), and puts serverInfo under a reserved `_meta`
// key rather than at the top level.
const PV_META = 'io.modelcontextprotocol/protocolVersion';
const SERVER_INFO_META = 'io.modelcontextprotocol/serverInfo';
const modern = (method, extra = {}) =>
  dispatch({ jsonrpc: '2.0', id: 1, method, params: { _meta: { [PV_META]: '2026-07-28', ...extra } } }, deps);

test('server/discover answers without a handshake', async () => {
  const res = await dispatch({ jsonrpc: '2.0', id: 1, method: 'server/discover' }, deps);
  assert.equal(res.result._meta[SERVER_INFO_META].name, 'com.vreeman/site-search');
  assert.ok(res.result.capabilities.tools);
  // Not `protocolVersion`: DiscoverResult advertises the whole window and lets the client pick.
  assert.ok(res.result.supportedVersions.includes('2026-07-28'));
  assert.equal(res.result.supportedVersions[0], '2026-07-28', 'newest first');
});

test('server/discover is a CacheableResult', async () => {
  // ttlMs and cacheScope are required by CacheableResult; this server is anonymous and read-only,
  // so its discovery response is the same for everyone and may be cached by shared proxies.
  const res = await dispatch({ jsonrpc: '2.0', id: 1, method: 'server/discover' }, deps);
  assert.equal(typeof res.result.ttlMs, 'number');
  assert.ok(res.result.ttlMs >= 0);
  assert.equal(res.result.cacheScope, 'public');
});

test('every result declares resultType, as 2026-07-28 requires', async () => {
  // "Servers implementing this protocol version MUST include this field." Absent is read as
  // "complete" by newer clients and ignored by older ones, so one helper can serve both eras.
  for (const method of ['server/discover', 'ping', 'tools/list']) {
    const res = await dispatch({ jsonrpc: '2.0', id: 1, method }, deps);
    assert.equal(res.result.resultType, 'complete', method);
  }
  const call = await dispatch(
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_content', arguments: { query: 'utm' } } }, deps);
  assert.equal(call.result.resultType, 'complete');
});

test('a request may declare its own protocol version', async () => {
  // Declared in params._meta under a reserved key — NOT params.protocolVersion, which is the
  // legacy handshake's field and exists only on `initialize`.
  const res = await modern('server/discover');
  assert.ok(res.result.supportedVersions.includes('2026-07-28'));
  const list = await modern('tools/list');
  assert.deepEqual(list.result.tools.map(t => t.name).sort(), ['search_content', 'search_meditations']);
});

test('a declared version we do not serve is UnsupportedProtocolVersionError, not a silent downgrade', async () => {
  // -32022 with {supported, requested} is how a modern client discovers the window and retries.
  // Answering anyway under a version we do not implement would be the worse failure.
  const res = await dispatch(
    { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { [PV_META]: '1999-01-01' } } }, deps);
  assert.equal(res.error.code, -32022);
  assert.equal(res.error.data.requested, '1999-01-01');
  assert.ok(res.error.data.supported.includes('2026-07-28'));
});

test('a request that declares no version at all is still served', async () => {
  // Pre-2025-06-18 clients never sent the version, and the transport lets a server that supports
  // them treat its absence as 2025-03-26. We do support them, so absence is not an error here.
  const res = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, deps);
  assert.equal(res.result.tools.length, 2);
});

test('legacy initialize still works', async () => {
  const res = await dispatch(
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, deps);
  assert.equal(res.result.protocolVersion, '2025-06-18');
  assert.equal(res.result.serverInfo.name, 'com.vreeman/site-search');
});

test('an unknown version falls back to the latest version a handshake can reach', async () => {
  // 2025-06-18, NOT 2026-07-28. A legacy client asking for a version we do not have gets "another
  // protocol version [we] support", and it will then speak the legacy handshake under whatever we
  // name. Naming 2026-07-28 would name the one revision that has no handshake, so the client would
  // stamp MCP-Protocol-Version: 2026-07-28 on legacy-shaped requests. The latest LEGACY version is
  // the only answer it can actually use.
  const res = await dispatch(
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, deps);
  assert.equal(res.result.protocolVersion, '2025-06-18');
});

test('discover and initialize describe the same server', async () => {
  const d = (await dispatch({ jsonrpc: '2.0', id: 1, method: 'server/discover' }, deps)).result;
  const i = (await dispatch({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, deps)).result;
  assert.deepEqual(d.capabilities, i.capabilities);
  assert.equal(d.instructions, i.instructions);
  assert.deepEqual(d._meta[SERVER_INFO_META], i.serverInfo);
});

// --- the HTTP envelope ----------------------------------------------------
// dispatch() is transport-agnostic; these go through onRequestPost so the headers and statuses are
// covered too. Node 24 has Request/Response globally, which is the same shape Workers exposes.
const post = (body) =>
  onRequestPost({ request: new Request('https://vreeman.com/mcp', { method: 'POST', body: JSON.stringify(body) }) });

test('the legacy handshake is answered with RFC 9745 deprecation headers', async () => {
  const res = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(res.status, 200);
  // RFC 9745 §2: "Deprecation is an Item Structured Header Field; its value MUST be a Date" — "@"
  // and a Unix timestamp. "true" is not a Date and a conforming parser would discard the field.
  const dep = res.headers.get('deprecation');
  assert.match(dep, /^@\d+$/, `Deprecation must be a structured-field Date, got ${JSON.stringify(dep)}`);
  assert.equal(new Date(Number(dep.slice(1)) * 1000).toISOString(), '2026-07-28T00:00:00.000Z');
  assert.match(res.headers.get('link'), /rel="deprecation"/);
  // Neither header is CORS-safelisted: unexposed, a browser client cannot read either one.
  const exposed = res.headers.get('access-control-expose-headers');
  for (const h of ['deprecation', 'link']) assert.match(exposed, new RegExp(h));
  // No Sunset: RFC 8594 makes it the time the resource becomes unresponsive, and no such time is
  // planned. Announcing one we would not honour is worse than announcing none.
  assert.equal(res.headers.get('sunset'), null);
});

test('only the legacy handshake is marked deprecated', async () => {
  const res = await post({ jsonrpc: '2.0', id: 1, method: 'server/discover' });
  assert.equal(res.headers.get('deprecation'), null);
  assert.equal(res.headers.get('link'), null);
  assert.equal((await res.json()).result.supportedVersions[0], '2026-07-28');
});

test('the transport pins two statuses to two error codes', async () => {
  const bad = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { [PV_META]: '1999-01-01' } } });
  // "MUST respond with 400 Bad Request and an UnsupportedProtocolVersionError listing its supported
  // versions" — and a modern JSON-RPC error in a 400 body is exactly how a dual-era CLIENT tells a
  // modern server from a legacy one, so a 200 here would provoke a needless fallback.
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, -32022);
  const unknown = await post({ jsonrpc: '2.0', id: 1, method: 'resources/list' });
  assert.equal(unknown.status, 404, 'an unimplemented method MUST be 404 with -32601');
  assert.equal((await unknown.json()).error.code, -32601);
  const fine = await post({ jsonrpc: '2.0', id: 1, method: 'ping' });
  assert.equal(fine.status, 200);
});

test('a browser client can send the headers 2026-07-28 requires', async () => {
  // Mcp-Method and Mcp-Name are REQUIRED on every modern request. Omitting them from the preflight
  // allowlist would block browser-based clients before dispatch() ever saw the request.
  const res = await post({ jsonrpc: '2.0', id: 1, method: 'ping' });
  const allowed = res.headers.get('access-control-allow-headers');
  for (const h of ['mcp-protocol-version', 'mcp-method', 'mcp-name']) assert.match(allowed, new RegExp(h));
});

// --- the published card and the running code -------------------------------
test('the server card advertises exactly what tools/list serves', async () => {
  // They were allowed to disagree while search_meditations was being built. They must not now: a
  // registry reads the card, an agent calls the endpoint, and a client that pre-validates arguments
  // against the card would reject calls the server would have accepted.
  const card = JSON.parse(readFileSync(new URL('../../../.well-known/mcp/server-card.json', import.meta.url), 'utf8'));
  const live = (await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, deps)).result.tools;
  assert.deepEqual(card.tools.map(t => t.name), live.map(t => t.name));
  for (const served of live) {
    const published = card.tools.find(t => t.name === served.name);
    assert.deepEqual(published.inputSchema, served.inputSchema, `${served.name} inputSchema`);
    assert.equal(published.title, served.title, `${served.name} title`);
    assert.equal(published.description, served.description, `${served.name} description`);
    // `annotations` is intentionally absent from the card — it is a hint to a client at call time,
    // not part of the published contract — so it is the one field not compared.
    assert.equal(published.annotations, undefined);
  }
});

test('the card and the code agree on the protocol window and the version', async () => {
  const card = JSON.parse(readFileSync(new URL('../../../.well-known/mcp/server-card.json', import.meta.url), 'utf8'));
  const d = (await dispatch({ jsonrpc: '2.0', id: 1, method: 'server/discover' }, deps)).result;
  assert.deepEqual(card.supportedProtocolVersions, d.supportedVersions);
  assert.deepEqual(card.remotes[0].supportedProtocolVersions, d.supportedVersions);
  assert.equal(card.protocolVersion, d.supportedVersions[0]);
  assert.deepEqual(card.capabilities, d.capabilities);
  assert.equal(card.serverInfo.version, d._meta[SERVER_INFO_META].version);
  assert.equal(card.version, d._meta[SERVER_INFO_META].version, 'the catalog copies this straight from the card');
  assert.equal(card.name, d._meta[SERVER_INFO_META].name);
});
