# MCP server

`functions/mcp.js` is a Cloudflare Pages Function serving **<https://vreeman.com/mcp>**: stateless
JSON-RPC 2.0 over the MCP Streamable HTTP transport, `application/json` only — no SSE, no sessions,
no auth, read-only. `GET` answers 405 (there is no stream to open); `OPTIONS` answers the CORS
preflight; a POSTed notification or response is acknowledged with 202 and no body. Batch arrays are
not supported. Spec: <https://modelcontextprotocol.io/specification/2025-06-18>.

## Tools

**`search_content`** — the 21-page `CATALOG` in the function itself, kept in sync by hand with the
WebMCP catalog in `index.html`. Case-insensitive substring over title, URL and tags; returns
`title — url` per hit.

**`search_meditations`** — the 499 entries of Books 1–12 of the *Meditations*. Returns the entry
label, a snippet around the hit and a deep link (`https://vreeman.com/meditations/#book4-3`), capped
at `MAX_RESULTS` = 20 with the total still stated in the first line. Books only: the Introduction,
Notes and Index of Persons are not in the corpus, so `Farquharson` finds nothing while `Verus` finds
five entries. An exact label such as `4.3` or `4.49a` matches that entry directly.

Both tools take one required string argument, `query`, and share one guard: a missing or
whitespace-only query is a tool error (`isError: true`), not a JSON-RPC error. An unknown tool name
is a JSON-RPC `-32602`.

## The corpus

`meditations/entries.json` — `{ id, label, text }` per entry, one entry per line, 210 KB, generated
by `tools/meditations-search/build-index.mjs` and committed. The function fetches it once per isolate
and caches the promise in module scope; `_headers` gives it `application/json`, open CORS and an hour
of edge cache. A failed fetch clears that cache so the next request retries — a rejected promise left
in module scope would otherwise break the tool for the whole life of the isolate.

### Rehydration: `withLower()`, never a second `groupEntries()` pass

The corpus deliberately ships without `lower`: it is derivable, and carrying it would nearly double
the file. But `findMatches()` reads `entry.lower` unconditionally and throws a `TypeError` without it,
so a consumer has to put it back. The only correct way is **`withLower()`**, exported from
`meditations/search.js` — the same helper `groupEntries()` itself ends with, so the fold is identical
in the browser and here.

Do **not** rehydrate by re-running `groupEntries()` over its own output. It strips a leading
`§ N.M` from an entry's text, so a second pass truncates any entry whose text legitimately begins with
its own number: `7.9 years of war taught him nothing.` would become `years of war taught him nothing.`
No entry in the current text trips it, which is exactly why a test holds the line rather than luck.

`withLower()` **mutates** its argument and returns it. What it is handed here is the module-scoped
cached array, so every request after the first in an isolate re-applies it to the same objects. That
is safe and deliberate — copying 499 objects per request would defeat the point of caching them.
It holds because `withLower()` is idempotent (pinned by a test in
`tools/meditations-search/test/index.test.mjs`) and fully synchronous, so no request can observe a
half-rehydrated array.

## Matching logic is imported, not duplicated

```js
import { findMatches, snippet, statusText, withLower } from "../meditations/search.js";
```

`search_meditations` is a formatter around the page's own search module. Quote folding, label
matching, snippet windowing and the `N entries match` wording have **one** definition, shared by the
reader's search box and the agent's tool call. Copying any of it back into the function would create
a third implementation of quote folding, free to drift.

Cloudflare Pages compiles `functions/` with esbuild and inlines relative imports, **including ones
reaching above `functions/`**. Verified rather than assumed:

    npx wrangler pages functions build --outfile=/tmp/mcp-bundle.js

Compiles clean at about **33 KiB** against the 1 MB limit, with every imported symbol inlined and no
unresolved import left in the output. The module's trailing `mountSearch(document)` is guarded on
`typeof document !== 'undefined'`, so it bundles in as a no-op — `document` does not exist in
workerd. The DOM adapters ride along as dead code; at 33 KB, splitting the module to shed them would
buy nothing (YAGNI).

The consequence is the point, not a cost: **editing `meditations/search.js` redeploys the function.**
The two surfaces cannot fall out of step.

## Tests

    node --test tools/mcp/test/*.test.mjs

`dispatch()` is exported and takes an optional `deps` — `dispatch(msg, { loadEntries })` — so the
corpus can be injected and the tool tested without a network fetch. That injection is the whole
reason `dispatch()` is async and exported.

`dispatch.test.mjs` covers both tools end to end, the shared empty-query guard, the unknown-tool
error, and that `initialize`/`ping` are unchanged. Four of its cases exist to pin things that a small
fixture cannot reach or that only a test can keep true:

- **truncation** is exercised against the real 499 entries (`the` matches 434), because a two-entry
  fixture can never reach `MAX_RESULTS`;
- **double rehydration** of one shared array must produce identical output and must not truncate
  `7.9 years of war…`;
- **`search_content`** is asserted byte-for-byte, and asserted never to touch the corpus loader;
- **every example query in the tool's own schema** is run against the real corpus. An agent copies
  those verbatim, and the first draft's `'retreats for themselves'` was Long's wording — this edition
  is Hays, where 4.3 reads `get away from it all`, so the advertised example found nothing.

## Checking the live endpoint

    curl -sS https://vreeman.com/mcp -H 'content-type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_meditations","arguments":{"query":"4.3"}}}'
