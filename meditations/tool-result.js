// The answer `search_meditations` gives, in one place.
//
// The tool exists twice — as a WebMCP tool on meditations/index.html (webmcp.js) and as an MCP tool
// on https://vreeman.com/mcp (functions/mcp.js) — under ONE name and one inputSchema, so that an
// agent which met either recognises the other. Two implementations of the answer would make that
// recognition a trap: the same query coming back in two shapes depending on which surface the agent
// happened to reach. So there is one implementation, and both surfaces import it.
//
// It costs neither side anything. Cloudflare Pages compiles functions/ with esbuild and inlines the
// transitive import graph at deploy time, so the server pays nothing. In the browser this file is
// fetched only after the WebMCP load guard in index.html has found an API to register with — never
// for a human reader, who downloads exactly what they downloaded before it existed.
//
// The matching itself stays in search.js, which the page's own search box runs: quote folding, label
// matching and snippets have one definition for readers and agents alike.
import { findMatches, MIN_QUERY, snippet, statusText } from './search.js';

// Twenty entries of ~140 characters is a few thousand tokens; a broad word like "nature" matches 96.
// Named in the tool description on both surfaces, so it cannot be raised here alone.
export const MAX_RESULTS = 20;

// `entries` must carry `lower` — entries.json ships without it, so a server-side caller rehydrates
// with withLower() first; an index built by buildIndex() already has it.
export function searchMeditations(entries, rawQuery) {
  const { query: q, matches } = findMatches(entries, rawQuery);
  // findMatches() returns no matches below MIN_QUERY without looking at the corpus. The page's search
  // panel renders an empty status line for that; to an agent, "no entries match" would be a false
  // negative it has no way to doubt.
  if (q.length < MIN_QUERY) {
    return `Queries must be at least ${MIN_QUERY} characters; "${q}" was not searched.`;
  }
  if (!matches.length) return `${statusText(0)} "${q}".`;
  // An exact entry number is a request to READ that entry, not to find it — and the server's
  // `instructions` promise this tool can quote one. A ~140-character window would leave the agent no
  // way to get the rest but to fetch all 210 KB of entries.json (4.3 alone is 2,378 characters). This
  // is the one place the browser's own semantics do not transfer: in the results list a snippet is a
  // link you click, here it is the whole answer. The label branch of findMatches() is also the only
  // way a match can carry no occurrence of the query in its text, since the leading "§ 4.3" is
  // stripped when the index is built.
  const exact = matches.length === 1 && matches[0].label === q;
  const shown = matches.slice(0, MAX_RESULTS);
  const capped =
    matches.length > MAX_RESULTS ? `; showing the first ${MAX_RESULTS} — refine the query for fewer` : '';
  // The edition is named per call: it appears in the tool description too, but an agent may not carry
  // that into its answer, and a Meditations quotation is worth attributing correctly.
  const head = `${statusText(matches.length)} "${q}" (trans. Hays${capped}):`;
  const lines = shown.map((e) => {
    let text = e.text;
    if (!exact) {
      const s = snippet(e, q);
      text = (s.leading ? '…' : '') + s.before + s.hit + s.after + (s.trailing ? '…' : '');
    }
    // Absolute, canonical links on both surfaces: an agent quotes the address of an entry, not
    // whatever host this copy of the page happened to be served from.
    return `• ${e.label} — ${text} — https://vreeman.com/meditations/#${e.id}`;
  });
  return [head, ...lines].join('\n');
}

