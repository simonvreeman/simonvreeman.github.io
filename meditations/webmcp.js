// WebMCP — exposes the Books search to an in-browser agent.
// Spec: https://webmachinelearning.github.io/webmcp/
//
// Loaded only by the inline guard in index.html, which feature-detects the API before fetching this
// file: a visitor whose browser has no WebMCP downloads nothing. That is why the guard lives in the
// page and not at the top of this module — a module that returns early has already been downloaded,
// parsed and pulled its own imports down with it.
//
// The tool name, inputSchema and description match `search_meditations` on https://vreeman.com/mcp,
// so an agent that knows one recognises the other — and because the names match, the ANSWER is not
// written here either: searchMeditations() comes from tool-result.js, the one module both surfaces
// run. Unlike the server, this side needs no corpus and no fetch: the entries are the page.

import { buildIndex } from './search.js';
import { searchMeditations } from './tool-result.js';

// mountSearch() builds an index too, lazily on first panel open, but keeps it in a closure and does
// not export it — so this is a second pass over the same 499 entries. That is accepted knowingly:
// the pass is ~30 ms over the real page (measured), happens only if an agent actually calls the
// tool, and happens once per page thanks to `??=`. The alternatives are worse: exporting
// mountSearch()'s index would put module-level mutable state in search.js and couple the tool to a
// widget that may never be opened; fetching entries.json would pull 210 KB over the network to
// re-read text the document already holds. buildIndex() is a pure read of `main > section[id=bookN]`,
// which nothing on the page mutates — the widget mounts after <header>, outside <main> — so building
// it twice is wasteful, never wrong.
//
// `??=` caches an empty index as readily as a full one ([] is not nullish). That cannot happen on
// this page — markup.test.mjs pins all 499 markers inside twelve `main > section[id=bookN]` — but if
// it ever could, every later call would answer "No entries match" for the life of the page. The test
// that would catch it is "the index is built once and kept" in webmcp.test.mjs, which is written to
// fail when the index is NOT reused; a `??=` over a truthiness test would need its mirror image.
let index = null;
const ensureIndex = () => (index ??= buildIndex(document));

export const tool = {
  name: 'search_meditations',
  title: 'Search the Meditations',
  description:
    "Search the 499 entries of Marcus Aurelius' Meditations (Books 1–12, Gregory Hays translation) " +
    'and return the matching entries with a deep link. Books only — the Introduction, Notes and ' +
    'Index of Persons are not searched. Each hit is a snippet of about 140 characters and at most ' +
    "20 are returned per call, so a broad word needs a narrower query; an exact entry number such " +
    "as '4.3' returns that entry's full text instead of a snippet.",
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: "A phrase, e.g. 'get away from it all', or an entry number such as '4.3'.",
      },
    },
    required: ['query'],
  },
  annotations: { readOnlyHint: true },
  async execute(input) {
    const query = input && input.query;
    // The server validates this in its JSON-RPC dispatcher, before the search function ever runs;
    // there is no dispatcher here, so the check lives at the seam an agent actually reaches — and
    // says the same sentence, which webmcp.test.mjs pins against the server's own rejection. Without
    // it, an empty query would fall through to "must be at least 2 characters", which describes a
    // search that was attempted rather than an argument that is missing.
    if (typeof query !== 'string' || query.trim() === '') {
      return {
        content: [{ type: 'text', text: "The 'query' argument is required (a non-empty search string)." }],
        isError: true,
      };
    }
    return { content: [{ type: 'text', text: searchMeditations(ensureIndex(), query) }], isError: false };
  },
};

// The current surface first, then the earlier draft's. Reading an absent property off `document` or
// `navigator` yields undefined rather than throwing, and both objects exist in every browser that
// can run this module at all, so the expression is safe without a typeof dance.
//
// Prefer the imperative registerTool() and fall through to the declarative provideContext() — on a
// THROW as well as on an absence, as the homepage's register() does. A registerTool() that exists
// and throws has registered nothing, so replacing a tool set that never received the tool is not the
// hazard it would be after a successful call.
//
// No stand-in when neither surface exists. This page is NOT the one isitagentready.com scans; the
// homepage is, and shims deliberately (see §5.2 of the agent-surfaces design). A fake API here would
// only tell other scripts on this page that a WebMCP agent is present when none is.
const mc = document.modelContext || navigator.modelContext;
if (mc) {
  let registered = false;
  if (typeof mc.registerTool === 'function') {
    try { mc.registerTool(tool); registered = true; } catch {}
  }
  if (!registered && typeof mc.provideContext === 'function') {
    try { mc.provideContext({ tools: [tool] }); } catch {}
  }
}
