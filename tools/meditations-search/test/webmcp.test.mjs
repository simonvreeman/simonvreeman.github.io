// meditations/webmcp.js is the browser twin of the `search_meditations` tool on https://vreeman.com/mcp.
// Two claims are worth pinning, and a markup regex proves neither:
//
// 1. SAME TOOL, SAME ANSWER. The name and inputSchema match the server's so that an agent which met
//    one recognises the other — which makes a differently-shaped answer a trap rather than a nicety.
//    So the browser output is compared against dispatch()'s own, over the same entries, instead of
//    against hand-written strings that could drift with it.
// 2. THE DOM SEAM. execute() builds its index from the rendered Books and keeps it, and the module
//    registers through whichever surface exists — installing nothing when neither does.
//
// webmcp.js reads `document` at import time (that is the whole point of it), so a fake DOM is
// installed as a global before each import. Each import below carries a different query string,
// which makes it a distinct module to the loader: that is how one process observes all three
// registration paths. `document` is swapped per test as well, because ensureIndex() reads the
// global at call time; node:test runs top-level tests sequentially, so the swaps cannot race.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { h, Document } from './fake-dom.mjs';
import { buildIndex } from '../../../meditations/search.js';
import { dispatch } from '../../../functions/mcp.js';

const MODULE = '../../../meditations/webmcp.js';

const shipped = JSON.parse(readFileSync(new URL('../../../meditations/entries.json', import.meta.url), 'utf8'));
const entry = id => shipped.find(e => e.id === id);

// Books 2–12 markup: <p><strong id="bookN-M">N.M</strong> text…</p>. Built from the shipped corpus
// so the page and the server are answering over the very same words.
const para = e => h('p', {}, h('strong', { id: e.id }, e.label), ' ' + e.text);

function pageOf(entries) {
  const doc = new Document();
  const books = new Map();
  for (const e of entries) {
    const n = /^book(\d+)-/.exec(e.id)[1];
    if (!books.has(n)) books.set(n, h('section', { id: `book${n}` }, h('h2', {}, `Book ${n}`)));
    books.get(n).append(para(e));
  }
  doc.body.append(h('header', { id: 'header' }), h('main', {}, ...books.values()));
  return doc;
}

const emptyPage = () => {
  const doc = new Document();
  doc.body.append(h('main', {}));
  return doc;
};

// Two entries, in document order; the same two, in the same order, are handed to dispatch().
const PAIR = [entry('book2-1'), entry('book4-3')];
const pairDoc = pageOf(PAIR);
const fullDoc = pageOf(shipped);

const callServer = (query, entries) =>
  dispatch(
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_meditations', arguments: { query } } },
    { loadEntries: async () => entries.map(e => ({ ...e })) } // copies: withLower() mutates
  );

// --- import 1: document.modelContext.registerTool -------------------------
const registered = [];
pairDoc.modelContext = { registerTool(t) { registered.push(t); return { name: t.name }; } };
globalThis.document = pairDoc;
await import(`${MODULE}?registerTool`);
delete pairDoc.modelContext;

// --- import 2: navigator.modelContext, provideContext only ----------------
// No document.modelContext at all, so this also proves the `document || navigator` fallback.
const provided = [];
navigator.modelContext = { provideContext(ctx) { provided.push(...ctx.tools); } };
globalThis.document = fullDoc;
const fullModule = await import(`${MODULE}?provideContext`);
delete navigator.modelContext;

const tool = registered[0];

test('the fixture pages reproduce the shipped corpus exactly', () => {
  // Everything below compares the page's answer with the server's over "the same entries"; that
  // claim is only worth anything if buildIndex() over this markup yields what entries.json ships.
  assert.deepEqual(
    buildIndex(fullDoc).map(({ id, label, text }) => ({ id, label, text })),
    shipped.map(({ id, label, text }) => ({ id, label, text }))
  );
});

test('the tool registers itself through document.modelContext.registerTool', () => {
  assert.equal(registered.length, 1);
  assert.equal(tool.name, 'search_meditations');
  assert.equal(typeof tool.execute, 'function');
  assert.equal(tool.annotations.readOnlyHint, true);
});

test('the browser tool and the server tool are the same tool', async () => {
  // The design's whole premise: "an agent that knows the server-side tool will recognise the browser
  // one immediately". That holds only while the name, the schema and the description agree.
  const res = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const server = res.result.tools.find(t => t.name === 'search_meditations');
  assert.equal(tool.name, server.name);
  assert.equal(tool.description, server.description);
  assert.deepEqual(tool.inputSchema, server.inputSchema);
  assert.deepEqual(tool.annotations, server.annotations);
});

test('the declarative surface gets the same tool', () => {
  assert.equal(provided.length, 1);
  assert.equal(provided[0].name, 'search_meditations');
});

test('execute() answers exactly what /mcp answers, entry for entry', async () => {
  globalThis.document = pairDoc;
  for (const query of ['retreats', '4.3', 'wake up', 'nothing whatsoever matches this']) {
    const mine = await tool.execute({ query });
    const theirs = await callServer(query, PAIR);
    assert.equal(mine.content[0].text, theirs.result.content[0].text, `query: ${query}`);
    assert.equal(mine.isError, theirs.result.isError, `isError for: ${query}`);
  }
});

test('over the whole book too: truncation, full entries, snippets, short queries', async () => {
  globalThis.document = fullDoc;
  for (const query of ['the', '4.3', 'get away from it all', 'Verus', 'I', 'zzzzz']) {
    const mine = await fullModule.tool.execute({ query });
    const theirs = await callServer(query, shipped);
    assert.equal(mine.content[0].text, theirs.result.content[0].text, `query: ${query}`);
  }
  // Spot-check the two shapes that distinguish this tool from a plain snippet search, so a future
  // change that makes BOTH sides wrong in the same way still fails here.
  const many = (await fullModule.tool.execute({ query: 'the' })).content[0].text.split('\n');
  assert.match(many[0], /^\d+ entries match "the" \(trans\. Hays; showing the first 20 — refine the query for fewer\):$/);
  assert.equal(many.length - 1, 20);
  const exact = (await fullModule.tool.execute({ query: '4.3' })).content[0].text.split('\n');
  assert.equal(exact[1], `• 4.3 — ${entry('book4-3').text} — https://vreeman.com/meditations/#book4-3`);
  assert.ok(exact[1].length > 2000, 'the full entry, not a ~145-character window');
});

test('a result line carries the label, a snippet and a deep link', async () => {
  globalThis.document = pairDoc;
  const lines = (await tool.execute({ query: 'get away from it all' })).content[0].text.split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^• 4\.3 — /);
  assert.match(lines[1], /get away from it all/);
  assert.match(lines[1], / — https:\/\/vreeman\.com\/meditations\/#book4-3$/);
});

test('a missing or empty query is refused the way the server refuses it', async () => {
  globalThis.document = pairDoc;
  for (const input of [undefined, {}, { query: '' }, { query: '   ' }, { query: 42 }]) {
    const res = await tool.execute(input);
    assert.equal(res.isError, true, `input: ${JSON.stringify(input)}`);
    assert.match(res.content[0].text, /'query' argument is required/);
  }
  // Byte-for-byte the server's wording, via its own rejection path.
  const theirs = await dispatch(
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_meditations', arguments: {} } },
    { loadEntries: async () => PAIR.map(e => ({ ...e })) }
  );
  assert.equal((await tool.execute({})).content[0].text, theirs.result.content[0].text);
});

test('the index is built once and kept', async () => {
  globalThis.document = pairDoc;
  const first = (await tool.execute({ query: 'retreats' })).content[0].text;
  // A page with no Books at all: a second buildIndex() would find nothing and the answer would change.
  globalThis.document = emptyPage();
  assert.equal((await tool.execute({ query: 'retreats' })).content[0].text, first);
});

// --- import 3: no API anywhere --------------------------------------------
test('with no WebMCP API present, nothing is registered and no stand-in is installed', async () => {
  const bare = pageOf(PAIR);
  globalThis.document = bare;
  assert.equal(navigator.modelContext, undefined);
  await import(`${MODULE}?none`);
  // Unlike the homepage — which shims deliberately, because isitagentready.com scans it in a browser
  // that implements neither surface — this page follows the spec: no stand-in, ever.
  assert.equal(bare.modelContext, undefined);
  assert.equal(navigator.modelContext, undefined);
});
