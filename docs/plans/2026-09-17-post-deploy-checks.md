# Agent surfaces — post-deploy checks

- **Date written:** 2026-09-17
- **Branch:** `agent-surfaces`
- **Design:** [2026-09-17-agent-surfaces-design.md](2026-09-17-agent-surfaces-design.md)
- **Implementation:** [2026-09-17-agent-surfaces-implementation.md](2026-09-17-agent-surfaces-implementation.md)
- **Status:** written but **not run** — every check below needs the branch live on
  `https://vreeman.com`.

Everything that can be checked from the repo already is: 234 tests across seven suites, all six
generators idempotent, `npx wrangler pages functions build` clean at 38,952 bytes, and every JSON
artifact parsing. What is left is the class of thing a test cannot reach — a response header Pages
actually emits, a `_headers` rule that matched the path you thought it would, a real client calling
the endpoint, and two third-party validators.

Run these in order after the deploy. **The one with a real chance of regressing is the WebMCP check
in §6** — it was green before this branch and depends on the homepage shim surviving.

---

## 1. Site-wide headers

```bash
curl -sI https://vreeman.com/ | grep -iE '^(link|tdm-reservation):'
```

Expect `tdm-reservation: 0`, and a `link:` carrying **five** relations — the two `gtm.vreeman.com`
hints, `rel="alternate"` for `schema.json`, and the two this branch added:

- `</llms.txt>; rel="describedby"; type="text/markdown"`
- `</.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"`

`_headers` writes these as one comma-separated `Link` line. If Cloudflare splits or reorders them
that is fine; a *missing* relation is not. `rel="agent-skills"` is a bare token rather than a URI —
a deliberate divergence from RFC 8288 §2.1.2, argued in `_headers` itself and in commit `1757ac0`.

Also confirm the `<link rel="describedby">` element survived in the five heads that carry it:
`index.html`, `meditations/index.html`, `discourses/index.html`, `seneca/index.html`,
`stockdale/index.html`. The header reaches agents that never parse HTML; the element reaches those
that only parse HTML. Both, deliberately.

## 2. Agent Skills content types

```bash
curl -sI https://vreeman.com/.well-known/agent-skills/index.json | grep -i content-type
curl -sI https://vreeman.com/.well-known/agent-skills/vreeman-stoic-library/SKILL.md | grep -i content-type
```

Expect `application/json` and `text/markdown; charset=utf-8`. Both are a **MUST** in the discovery
RFC: an index that is not `application/json`, or a `SKILL.md` that arrives as `text/html`, is a skill
a conformant client refuses. This is the check that matters most in this file, because it is testing
a `_headers` glob (`/.well-known/agent-skills/*/SKILL.md`) that nothing local can exercise.

While there, confirm `access-control-allow-origin: *` on both, and that **`SKILL.md` has no
`Cache-Control`** — that absence is deliberate. Each index entry carries a SHA-256 of the file, and a
cached `SKILL.md` outliving the index that describes it is a digest mismatch, which clients MUST
treat as tampering.

Optionally verify the digest end to end:

```bash
curl -s https://vreeman.com/.well-known/agent-skills/vreeman-stoic-library/SKILL.md | shasum -a 256
```

must equal the `digest` in `index.json`, currently
`11cb3977f1f1cd7c7f5ffa7a035f92bb8f83bfe8da0a9e9fdca5778781f2ea8d`. A mismatch here with a green
local suite means the transfer changed the bytes — a CDN rewrite, or line endings.

## 3. The corpus

```bash
curl -s https://vreeman.com/meditations/entries.json | head -c 200
```

Expect the file to open with `[` on its own line, then
`{"id":"book1-1","label":"1.1","text":"My grandfather Verus Character and self-control."},` — a JSON
array, one entry per line.
Check the headers too (`application/json`, `access-control-allow-origin: *`,
`cache-control: public, max-age=3600`); the MCP function fetches this cross-origin from workerd and a
Pages HTML error page would resolve as a 200 with the wrong shape.

## 4. The MCP endpoint

```bash
curl -s -X POST https://vreeman.com/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"server/discover"}'
```

Expect a `DiscoverResult`: `supportedVersions` newest-first starting `2026-07-28`, `capabilities`,
`instructions`, `ttlMs`/`cacheScope`, `resultType: "complete"`, and `serverInfo` under
`_meta["io.modelcontextprotocol/serverInfo"]` — **not** at the top level, and **no** singular
`protocolVersion`.

```bash
curl -s -X POST https://vreeman.com/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_meditations","arguments":{"query":"get away from it all"}}}'
```

Expect a `content[0].text` whose first line names the edition —
`1 entry matches "get away from it all" (trans. Hays):` — and one `• 4.3 — … — https://vreeman.com/meditations/#book4-3`
line. This is the first time the tool runs against the *deployed* corpus rather than an injected one,
so it is really a test of the fetch, the cache and `withLower()` in workerd. Try `"4.3"` too: it must
come back as the whole entry, not a 140-character window.

```bash
curl -sD- -o/dev/null -X POST https://vreeman.com/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  | grep -i deprecation
```

Expect **`deprecation: @1785196800`** and a `link: <…>; rel="deprecation"`. The `@`-prefixed integer
is the point: RFC 9745 makes `Deprecation` an Item Structured Field whose value must be a Date, and
`Deprecation: true` is discarded by a conforming parser. If Cloudflare has mangled the `@` or dropped
the header, the notice is worse than none. Confirm the same call on `server/discover` carries
**neither** header — only the legacy handshake is deprecated.

Two more worth a minute, since neither can be seen locally:

```bash
curl -s -o/dev/null -w '%{http_code}\n' -X POST https://vreeman.com/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":4,"method":"resources/list","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28"}}}'
# 404 — a modern client gets the status the transport pins to -32601

curl -s -o/dev/null -w '%{http_code}\n' -X POST https://vreeman.com/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":5,"method":"resources/list"}'
# 200 — a legacy client still gets the status it has always had
```

## 5. JSON artifacts over the wire

Re-parse each of these from the deployed origin, not just from disk — a Pages error page is HTML with
a 200 and will fail here, which is the point:

```
/.well-known/ai-catalog.json
/.well-known/did.json
/.well-known/mcp/server-card.json
/.well-known/agent-skills/index.json
/meditations/entries.json
/schema.json
/manifest.json
/site.webmanifest
```

## 6. isitagentready.com — `webMcp` is the regression risk

Run the site through <https://isitagentready.com/>.

- **`checks.discovery.agentSkills`** should now pass. It did not exist before this branch.
- **`checks.discovery.webMcp` was already green (confirmed 2026-06-02, commit `a0ac52c`) and must
  stay green.** This is the check to look at first.

The scanner evaluates WebMCP **at runtime, in a headless browser that has no native WebMCP API**, and
its evidence string reads "No tools registered via `navigator.modelContext`". The homepage's inline
shim exists precisely so the tool stays detectable in that browser. Task 7 changed exactly one thing
there — consult `document.modelContext` before `navigator.modelContext` — and **kept the shim**. If
`webMcp` has gone red, the cause is almost certainly that the shim was removed or the homepage bundle
was put behind a load guard; it is not a reason to "fix" the homepage toward the spec, which is the
change that would break it. See §5.2 of the design for why the two pages differ on purpose.

`meditations/index.html` is *not* the scanned surface and deliberately does the spec-clean thing
instead: load guard, no shim, `document.modelContext` first. On a browser with no WebMCP, the network
panel on `/meditations/` must show **no request** for `webmcp.js` — not a request whose script returns
early. On a browser that does ship the API, `typeof document.modelContext?.registerTool === 'function'`
and the agent UI lists `search_meditations`.

## 7. Rich Results Test on `/meditations/`

<https://search.google.com/test/rich-results> on `https://vreeman.com/meditations/`.

The graph must still parse after task 11 changed the `WebSite` node's `@id` to the absolute
`https://vreeman.com/#website` (in `index.html`, `meditations/index.html` and `schema.json`) and
de-tagged that page's `og:url`. A relative `#website` resolves against the containing page, so the
point of the change is that the three files now name **one** node; a parse error, or two `WebSite`
entities, means it did not take.

Known and expected: the graph still carries a dangling `hasPart` reference to `#book7-56` with no node
defining it (backlog B5 in the design doc). The Rich Results Test does not flag it — it is a missing
node, not a bad URL — so do not read a clean result as evidence that B5 is fixed.

## 8. Spot-check `og:url` on a Seneca letter

Task 13 rewrote `og:url` on 80 tracked pages, most of them Seneca letters that had shipped an empty
one. Open any letter's source on the live site and confirm `og:url` equals its `<link rel="canonical">`
— e.g. `https://vreeman.com/seneca/letter-42` on both tags. A social-card debugger on that URL is the
stronger version of the same check: before this branch, a share of a Seneca letter advertised no
canonical identity at all and the platform fell back to whatever URL it was handed.
