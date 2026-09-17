// WebMCP — exposes the Books search to an in-browser agent.
// Spec: https://webmachinelearning.github.io/webmcp/
//
// Loaded only by the inline guard in index.html, which feature-detects the API before fetching this
// file: a visitor whose browser has no WebMCP downloads nothing. That is why the guard lives in the
// page and not at the top of this module — a module that returns early has already been downloaded,
// parsed and (with search.js) pulled a second file down with it.
//
// The tool name, inputSchema and description match `search_meditations` on https://vreeman.com/mcp,
// so an agent that knows one recognises the other. Because the names match, the ANSWERS have to
// match too — the same query must not come back in two shapes depending on which surface the agent
// happened to reach. searchMeditations() below is therefore a deliberate mirror of the function of
// the same name in functions/mcp.js; change one and tools/meditations-search/test/webmcp.test.mjs
// fails, because it compares the two outputs directly over the shipped corpus.
//
// Unlike the server, this side needs no corpus and no fetch: the entries are the page.

import { buildIndex, findMatches, MIN_QUERY, snippet, statusText } from './search.js';

const MAX_RESULTS = 20;

// mountSearch() builds an index too, lazily on first panel open, but keeps it in a closure and does
// not export it — so this is a second pass over the same 499 entries. That is accepted knowingly:
// the pass is ~30 ms over the real page (measured), happens only if an agent actually calls the
// tool, and happens once per page thanks to `??=`. The alternatives are worse: exporting
// mountSearch()'s index would put module-level mutable state in search.js and couple the tool to a
// widget that may never be opened; fetching entries.json would pull 210 KB over the network to
// re-read text the document already holds. buildIndex() is a pure read of `main > section[id=bookN]`,
// which nothing on the page mutates — the widget mounts after <header>, outside <main> — so building
// it twice is wasteful, never wrong.
let index = null;
const ensureIndex = () => (index ??= buildIndex(document));

// A mirror of searchMeditations() in functions/mcp.js, down to the wording. See the note above.
// The deep links are absolute vreeman.com URLs, as the server's are: an agent quotes the canonical
// address of an entry, not whatever host this copy of the page was served from.
export function searchMeditations(entries, rawQuery) {
  const { query: q, matches } = findMatches(entries, rawQuery);
  // findMatches() returns no matches below MIN_QUERY without looking at the corpus. The search panel
  // renders an empty status line for that; to an agent, "no entries match" would be a false negative
  // it has no way to doubt.
  if (q.length < MIN_QUERY) {
    return `Queries must be at least ${MIN_QUERY} characters; "${q}" was not searched.`;
  }
  if (!matches.length) return `${statusText(0)} "${q}".`;
  // An exact entry number is a request to READ that entry, not to find it: a ~140-character window
  // would leave the agent no way to get the rest. (It is also the only way a match can carry no
  // occurrence of the query in its text, since the leading "§ 4.3" is stripped when the index is
  // built.) The browser's own results list keeps showing snippets — there a snippet is a link you
  // click, here it is the whole answer.
  const exact = matches.length === 1 && matches[0].label === q;
  const shown = matches.slice(0, MAX_RESULTS);
  const capped =
    matches.length > MAX_RESULTS ? `; showing the first ${MAX_RESULTS} — refine the query for fewer` : '';
  // The edition is named per call: it is in the tool description too, but an agent may not carry
  // that into its answer, and a Meditations quotation is worth attributing correctly.
  const head = `${statusText(matches.length)} "${q}" (trans. Hays${capped}):`;
  const lines = shown.map((e) => {
    let text = e.text;
    if (!exact) {
      const s = snippet(e, q);
      text = (s.leading ? '…' : '') + s.before + s.hit + s.after + (s.trailing ? '…' : '');
    }
    return `• ${e.label} — ${text} — https://vreeman.com/meditations/#${e.id}`;
  });
  return [head, ...lines].join('\n');
}

export const tool = {
  name: 'search_meditations',
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
    // there is no dispatcher here, so the check lives at the same seam an agent reaches — and says
    // the same sentence. Without it, an empty query would fall through to "must be at least 2
    // characters", which describes a search that was attempted rather than an argument that is missing.
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
// No stand-in when neither exists. This page is NOT the surface isitagentready.com scans; the
// homepage is, and shims deliberately (see Task 7 and §5.2 of the design). Installing a fake API
// here would only tell other scripts on this page that a WebMCP agent is present when none is.
const mc = document.modelContext || navigator.modelContext;
if (mc) {
  if (typeof mc.registerTool === 'function') {
    try { mc.registerTool(tool); } catch {}
  } else if (typeof mc.provideContext === 'function') {
    // provideContext() REPLACES the tool set, so this branch is reached only when the imperative
    // call is unavailable — never as a second registration of the same tool.
    try { mc.provideContext({ tools: [tool] }); } catch {}
  }
}
