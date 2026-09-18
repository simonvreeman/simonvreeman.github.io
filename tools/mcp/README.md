# MCP server

`functions/mcp.js` is a Cloudflare Pages Function serving **<https://vreeman.com/mcp>**: stateless
JSON-RPC 2.0 over the MCP Streamable HTTP transport, `application/json` only — no SSE, no sessions,
no auth, read-only. `GET` answers 405 (there is no stream to open); `OPTIONS` answers the CORS
preflight; a POSTed notification or response is acknowledged with 202 and no body. Batch arrays are
not supported. Spec: <https://modelcontextprotocol.io/specification/2026-07-28>.

## Protocol versions: one URL, both eras

The 2026-07-28 revision removed the `initialize` handshake. Every request now declares its own
protocol version in `params._meta["io.modelcontextprotocol/protocolVersion"]` (mirrored into the
`MCP-Protocol-Version` header), protocol-level sessions and the standalone `GET` stream are gone, and
**`server/discover` is mandatory**. The endpoint serves both eras, which the spec explicitly permits
— "a dual-era server MAY serve both eras concurrently on the same endpoint" — because a legacy client
opens with a handshake and has no way to fall forward when one is refused.

- **`server/discover`** returns a `DiscoverResult`: `supportedVersions` (an array, newest first — there
  is no singular `protocolVersion` on it), `capabilities`, `instructions`, the `ttlMs`/`cacheScope`
  that `CacheableResult` requires, and `serverInfo` under `_meta["io.modelcontextprotocol/serverInfo"]`
  rather than at the top level.
- **`initialize`** keeps answering, in its own legacy shape, and is *not* a delegation to
  `server/discover` — the two results differ in every field named above. It negotiates against the
  **legacy** list only: naming 2026-07-28 to a client that speaks the handshake would name the one
  revision that has none, and the client would then stamp `MCP-Protocol-Version: 2026-07-28` on
  legacy-shaped requests. `SUPPORTED_PROTOCOL_VERSIONS` omits 2025-11-25, a legacy revision we do not
  implement, rather than claiming it.
- **A version we do not serve** is refused with `-32022` (`UnsupportedProtocolVersionError`) carrying
  `{ supported, requested }`, at HTTP **400** — never answered under some other revision. That one is
  unconditional: only a request that declared a version can produce it, so a client that can see it
  is modern by construction. An unimplemented method is `-32601` at HTTP **404** **only for a request
  that declared a version**; a legacy client still gets the 200 it has always had here, because the
  MUST lives in the 2026-07-28 binding and an older SDK transport that checks `response.ok` before
  parsing would turn a clean "Method not found" into a transport throw. Those two statuses are how a
  dual-era *client* tells a modern server from a legacy one, so they are not cosmetic.
- **A mirrored header that contradicts the body is refused** with `-32020` (`HeaderMismatchError`) at
  HTTP **400**, before dispatch. 2026-07-28 lets a client mirror `MCP-Protocol-Version`, `Mcp-Method`
  and (on `tools/call`) `Mcp-Name` into request headers so a proxy can route without parsing the
  body; if the two disagree, the proxy and the server are acting on different requests, and guessing
  which one is authoritative is the wrong repair. A `Mcp-Name` in the `=?base64?…?=` sentinel form is
  decoded before it is compared, as the spec requires. A **missing** mirrored header is deliberately
  not a mismatch — mirroring is optional.
- **An absent version is served, not refused.** The transport allows that for a server supporting
  clients older than 2025-06-18, which never sent a version at all; we support them.
- **Every result carries `resultType: "complete"`**, which 2026-07-28 requires of every result.
  Earlier revisions read an absent one as `"complete"` and ignore unknown fields, so one `ok()`
  helper serves both eras.

### Deprecating the handshake

A response to `initialize` — and only to `initialize` — carries `Deprecation` and a `deprecation`
`Link`. Per **RFC 9745** `Deprecation` is an Item Structured Field whose value **must be a Date**:
`@1785196800` (2026-07-28T00:00:00Z, the day the handshake-less revision shipped). `Deprecation: true`
is not a Date and a conforming parser discards it — a malformed header is worse than none. Both are
named in `Access-Control-Expose-Headers`, since neither is CORS-safelisted and a browser-based client
would otherwise be handed a notice it cannot read.

There is deliberately **no `Sunset`**. RFC 8594 defines it as the time the resource becomes
unresponsive, and no such time is planned: the spec schedules no removal for dual-era servers. Add
one (an IMF-fixdate, e.g. `Wed, 30 Sep 2027 00:00:00 GMT`) only when removal is genuinely planned,
with more notice than a few weeks.

Whether a request was the legacy handshake is a property of the **request**, so `onRequestPost`
derives these headers from `msg.method` rather than having `dispatch()` smuggle a flag out on the
response object. `dispatch()` stays a pure message-in/message-out function with one return value and
callers get a response with nothing to strip.

### The card and the code

`.well-known/mcp/server-card.json` is the published advertisement for this endpoint, and
`dispatch.test.mjs` holds the two in agreement: same tool names, and identical `inputSchema`, `title`
and `description` per tool, plus the same protocol window, capabilities, server name, title and
version. `annotations` is the one field excluded — it is a call-time hint, not part of the published
contract. The card's `version` is also what `tools/ards/build.mjs` copies into
`.well-known/ai-catalog.json`, so bumping it there is what moves the catalog.

`card.description`, `card.endpoint`, `card.websiteUrl`, `card.repository` and `card.remotes[0].url`
have **no counterpart in the code** — nothing in `functions/mcp.js` serves them — so no test here can
hold them true. They are checked by reading them. `remotes[0].supportedProtocolVersions` is the
exception and is compared, because the code does have a protocol window to compare against.

**Watch-item:** every run of `tools/ards/build.mjs` restamps `updatedAt` on *both* catalog entries,
including the OKF bundle, because `buildCatalog()` takes a single timestamp for the whole document.
A registry therefore sees the OKF bundle as updated whenever the MCP card changes. Harmless today; if
it ever matters the fix is per-entry provenance in the generator, not a change to this endpoint.

## Tools

**`search_content`** — the 21-page `CATALOG` in the function itself, kept in sync by hand with the
WebMCP catalog in `index.html`. Case-insensitive substring over title, URL and tags; returns
`title — url` per hit.

**`search_meditations`** — the 499 entries of Books 1–12 of the *Meditations*. Returns the entry
label, a ~140-character snippet around the hit and a deep link
(`https://vreeman.com/meditations/#book4-3`), capped at `MAX_RESULTS` = 20 — defined once in
`meditations/tool-result.js`, named in the tool description on both surfaces, so it cannot be raised
on one of them alone — with the total still stated in the first line, which also says to refine the
query. There is deliberately **no paging**:
`offset` on a stateless endpoint means re-fetching and re-matching the corpus per page, and the
honest answer to a 434-hit query is a better query. Books only: the Introduction, Notes and Index of
Persons are not in the corpus, so `Farquharson` finds nothing while `Verus` finds five entries.

The head line names the edition — `5 entries match "verus" (trans. Hays):`. That costs about eight
tokens per call and is what makes the result citable; the translation is named in the tool
description too, but an agent may not carry that into its answer.

**An exact entry number returns the entry in full**, not a snippet — 2,378 characters for 4.3, not a
~140-character window of it. `searchMeditations()` takes that branch explicitly, on
`matches.length === 1 && matches[0].label === query`, rather than letting `snippet()` fall back: the
leading `§ 4.3` is stripped from the text at build time, so the label branch of `findMatches()` is
the one way a match can carry no occurrence of the query at all, and a fallback window would silently
start the answer at the opening of the entry for reasons a reader of the code has to reconstruct.

This is the one place the browser's semantics do not transfer: on the page a snippet is a link you
click, over MCP it is the whole answer, and `instructions` promises the tool can quote a specific
entry. The alternative was an agent fetching all 210 KB of `entries.json` to finish a quotation.

Both tools take one required string argument, `query`, and share one guard: a missing or
whitespace-only query is a tool error (`isError: true`), not a JSON-RPC error. An unknown tool name
is a JSON-RPC `-32602`. A query shorter than `MIN_QUERY` (2 characters) says so explicitly rather
than reporting no matches: `findMatches()` returns empty below that without consulting the corpus, so
`No entries match` would be a false negative the agent has no way to doubt. The browser renders an
empty status line in that case and has no equivalent to state.

## The corpus

`meditations/entries.json` — `{ id, label, text }` per entry, one entry per line, 210 KB, generated
by `tools/meditations-search/build-index.mjs` and committed. The function fetches it once per isolate
and caches the promise in module scope; `_headers` gives it `application/json`, open CORS and an hour
of edge cache. A failed load clears that cache so the next request retries — a rejected promise left
in module scope would otherwise break the tool for the whole life of the isolate.

Both the `r.ok` check and the "is it an array" check live **inside** that promise chain, so the
`.catch` that clears the cache can see them. `fetch()` does not reject on a 404 — Pages answers one
with its HTML error page — so validating after the fact would let a bad response resolve, get cached,
and fail in `withLower()` on every later request, telling the client to try again when trying again
could never work.

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

## The answer is imported, not duplicated

```js
import { searchMeditations } from "../meditations/tool-result.js";
import { withLower } from "../meditations/search.js";
```

`search_meditations` exists **twice** — here, and as a WebMCP tool on `meditations/index.html`
(`meditations/webmcp.js`) — under one name and one `inputSchema`, so that an agent which met either
recognises the other. That recognition is what makes two implementations of the answer a trap rather
than a duplication: the same query coming back in two shapes depending on which surface the agent
happened to reach. So the whole answer — the head line, the `MAX_RESULTS` cap and its "refine the
query" note, the `• label — text — url` lines, the full-entry branch for an exact number, the
below-`MIN_QUERY` message — lives in **`meditations/tool-result.js`**, and both surfaces import it.
This function's remaining job for that tool is JSON-RPC: validate `query`, load and rehydrate the
corpus, wrap the string in a `content` block.

`tool-result.js` in turn imports `findMatches`, `snippet`, `statusText` and `MIN_QUERY` from
`meditations/search.js` — the module the page's own search box runs. Quote folding, label matching,
snippet windowing and the `N entries match` wording therefore have **one** definition, shared by the
reader's search box and the agent's tool call. Copying any of it back into the function would create
a third implementation of quote folding, free to drift.

The split costs neither side anything. Cloudflare Pages inlines the transitive import graph at
deploy time, so the server pays nothing; in the browser `tool-result.js` is fetched only after the
WebMCP load guard has found an API to register with, never for a human reader.

`withLower` is imported straight from `search.js` rather than through `tool-result.js` because
rehydration is the *server's* problem alone: `entries.json` ships without `lower`, while the
browser's `buildIndex()` already has it.

Cloudflare Pages compiles `functions/` with esbuild and inlines relative imports, **including ones
reaching above `functions/`**. Verified rather than assumed:

    npx wrangler pages functions build --outfile=/tmp/mcp-bundle.js

Compiles clean at **38,952 bytes** (38 KiB, measured 2026-09-17) against the 1 MB limit, with every
imported symbol inlined and no unresolved import left in the output. `search.js`'s trailing
`mountSearch(document)` is guarded on `typeof document !== 'undefined'`, so it bundles in as a no-op
— `document` does not exist in workerd. The DOM adapters ride along as dead code; at this size,
splitting the module to shed them would buy nothing (YAGNI). The risk worth guarding is the other
one — someone adding an *unguarded*
top-level `window`/`document` reference to `search.js` and breaking the import here. The existing
suite already catches it: `tools/meditations-search/test/dom.test.mjs` imports `search.js` in bare
Node, where neither global exists, so such an edit fails the tests long before it reaches a deploy.

The consequence is the point, not a cost: **editing `meditations/search.js` or
`meditations/tool-result.js` redeploys the function.** The two surfaces cannot fall out of step.

## Tests

    node --test tools/mcp/test/*.test.mjs

`dispatch()` is exported and takes an optional `deps` — `dispatch(msg, { loadEntries })` — so the
corpus can be injected and the tool tested without a network fetch. That injection is the whole
reason `dispatch()` is async and exported.

`dispatch.test.mjs` covers both tools end to end, the shared empty-query guard, the unknown-tool
error, and that `initialize` negotiates the version and advertises both tools (its `instructions`
changed with this tool, so the field is asserted rather than assumed). Several cases exist to pin
things a small fixture cannot reach, or that only a test can keep true:

- **truncation** is exercised against the real 499 entries (`the` matches 434), because a two-entry
  fixture can never reach `MAX_RESULTS`;
- **double rehydration** of one shared array must produce identical output and must not truncate
  `7.9 years of war…`;
- **`search_content`** is asserted byte-for-byte, and asserted never to touch the corpus loader;
- **every example query in the tool's own schema** is run against the real corpus. An agent copies
  those verbatim, and the first draft's `'retreats for themselves'` was Long's wording — this edition
  is Hays, where 4.3 reads `get away from it all`, so the advertised example found nothing;
- **an exact entry number** must return the entry byte-for-byte, and a phrase inside the same entry
  must still get a snippet. (Do not assert the *absence* of `…` from a full entry: Hays writes one
  into 4.3 for a lacuna, `ward off all < … >`.)

One test, `a failed load does not poison the isolate`, stubs `globalThis.fetch` to exercise the
default loader across a rejection, a 404, a 200 carrying the wrong shape, a good corpus and finally
the cache. It must stay the **only** one of its kind in the process: `entriesPromise` is module-scoped
with no way to reset it from outside, so a second fetch-stub test would inherit whatever this one left
cached and feed its own stub back into it. Every other test injects `deps.loadEntries` instead.

## Checking the live endpoint

    curl -sS https://vreeman.com/mcp -H 'content-type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_meditations","arguments":{"query":"4.3"}}}'

The full post-deploy list — `server/discover` over the wire, the RFC 9745 `Deprecation` header, the
two HTTP statuses gated on client era, and the checks outside this endpoint — is
[`docs/plans/2026-09-17-post-deploy-checks.md`](../../docs/plans/2026-09-17-post-deploy-checks.md).
