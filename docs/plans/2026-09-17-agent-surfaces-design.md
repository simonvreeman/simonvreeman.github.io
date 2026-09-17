# Agent surfaces: entry-level Meditations search, MCP/WebMCP modernisation, discovery fixes — Design

- **Date:** 2026-09-17
- **Status:** **Implemented 2026-09-17** on branch `agent-surfaces`, all 13 tasks of the [implementation plan](2026-09-17-agent-surfaces-implementation.md). 234 tests green across seven suites (`node --test tools/*/test/*.test.mjs`). Checks that need the live site are in [2026-09-17-post-deploy-checks.md](2026-09-17-post-deploy-checks.md) and are **not yet run**.
- **Author:** Simon Vreeman (with Claude Code)
- **Scope:** Expose the Books-only *Meditations* search (shipped 2026-09-16, see [that design](2026-09-16-meditations-search-design.md)) to AI agents; bring the site's two agent surfaces up to the specifications that moved in July–September 2026; close three discovery gaps.
- **Source of the audit:** [The Website Specification](https://specification.website/), via its MCP server, 2026-09-17.

---

## 1. Decisions (locked)

| Decision | Choice |
|---|---|
| URL state for the search (`?q=`) | **No.** `meditations/search.js` keeps its current behaviour; the query never reaches the address bar |
| `SearchAction` in the Meditations JSON-LD | **Dropped.** Its `target` is a fetchable `urlTemplate`; without `?q=` there is nothing honest to point it at |
| How agents reach the search instead | A `search_meditations` tool on **both** agent surfaces, returning `#bookN-M` deep links |
| Corpus for the server-side tool | A generated `meditations/entries.json`; also serves `machine-readable-formats` on its own merits |
| Parsing rules | Reused from the shipped `meditations/search.js`. Only the HTML→items step is new |
| Tool naming | Identical `name` and `inputSchema` on the HTTP MCP server and in WebMCP, per the WebMCP spec |
| OKF v0.2, per-page `.md` endpoints | Out of scope; recorded as backlog in §7 |

## 2. Audit findings this design acts on

Ten findings, from the spec categories `agent-readiness`, `seo` and `security`. Status in brackets is the spec's own.

**The search is invisible to machines**

1. No URL state, so no linkable result and no `SearchAction` target. *[recommended]* — accepted, see §1.
2. The graph carries `ReadAction` only. *[recommended]* — resolved by §3 rather than by markup.
3. Entry-level search reaches neither `/mcp` nor WebMCP; both know *Meditations* as one page. *[optional]* — §3.

**Drifted since the spec updated**

4. `/llms.txt` exists but is never advertised — no `rel="describedby"` link, no `Link` header. v2's one hard addition (2026-08-21); Lighthouse's agentic-browsing checks audit for it. *[recommended]* — §5.1.
5. `functions/mcp.js` is handshake-only at `2025-06-18`: no `server/discover`, no per-request `protocolVersion`. MCP's 2026-07-28 revision removed the handshake. *[optional]* — §4.1.
6. WebMCP on the homepage detects `navigator.modelContext` only; the current surface is `document.modelContext`. It also assigns a stand-in object when the API is absent. *[optional]* — §4.2.
7. `ai-catalog.json` advertises the OKF bundle as `"version": "0.1"`; the spec is at v0.2. *[optional]* — backlog, §7.

**Gaps**

8. No `/.well-known/agent-skills` index. *[recommended]* — §5.2.
9. No `tdm-reservation` header. *[optional]* — §5.3.
10. No per-page Markdown source endpoints for the Stoic library. *[recommended]* — backlog, §7.

Already correct, and to be left alone: `sitemap.xml` carries no `<?xml-stylesheet?>` (the spec dropped it 2026-09-10); no `X-XSS-Protection` anywhere (now `avoid`); `Content-Signal` is set in `robots.txt`.

## 3. Repository facts the design relies on

- **No `package.json`, no dependencies, anywhere in the repo.** Nothing available can parse `meditations/index.html` into a DOM. `tools/meditations-search/test/fake-dom.mjs` is a 115-line hand-built stand-in with no HTML parser; `markup.test.mjs` regexes the raw HTML instead.
- `meditations/search.js` is an ES module. `normalizeText`, `groupEntries`, `findMatches`, `statusText` and `snippet` touch no DOM, and the only top-level DOM access is guarded by `if (typeof document !== 'undefined')`. **Node can import it unchanged.** `groupEntries` consumes `[{ marker, text }]` in document order — that array is the seam a generator can fill without a DOM.
- **499 entries**: Book 1 uses `<h3 id="book1-N">` (17), Books 2–12 use `<strong id="bookN-M">` (482, of which 11 carry a letter suffix such as `book4-49a`). `markup.test.mjs` already asserts these counts against the raw HTML.
- Every entry already has a stable anchor, so `https://vreeman.com/meditations/#book4-3` resolves today. **The results are addressable; only the query is not.** This is what makes §3 possible without §1.
- `.well-known/ai-catalog.json` is **generated** by `tools/ards/build.mjs` from `.well-known/mcp/server-card.json`. Declaring a tool in the server card and regenerating is the whole change; the catalog is never hand-edited.
- `functions/mcp.js` is a Cloudflare Pages Function at `https://vreeman.com/mcp`: stateless JSON-RPC 2.0, `application/json` only, no SSE, no sessions, no auth, read-only. One tool, `search_content`, over a 21-entry hand-written `CATALOG`.
- Repo convention for generators: `tools/<name>/build.mjs` + `lib/*.mjs` + `test/*.test.mjs`, run with `node --test tools/<name>/test/*.test.mjs`. Node 24, `node:test`, no runner config.

---

## 4. Component A — entry-level search as an agent capability

### 4.1 `meditations/entries.json` (generated)

```json
[{ "id": "book4-3", "label": "4.3", "text": "People look for retreats for themselves…" }, …]
```

499 objects, document order, one per line. 210 KB.

Produced by `tools/meditations-search/build-index.mjs`. The generator does exactly one new thing: scan `meditations/index.html` for the twelve `<section id="bookN">` blocks and emit `{ marker, text }` items in document order, applying the same two exclusions the browser applies (`<sup>` footnote markers, `.return` § links) and the same `<br>`/`<li>`/`<p>` padding rule. It then calls **`groupEntries()` imported from `../../meditations/search.js`**, so labels, the stripped leading `§ 4.3`, quote folding and whitespace collapsing cannot drift from what readers get in the browser. `lower` is dropped before writing — it is derivable, and doubling the file to carry it would be waste.

This artifact justifies itself independently of the tools below: it satisfies `machine-readable-formats` by handing any agent the entire book as typed data in one fetch instead of 516 KB of HTML to scrape.

**Sync obligation.** The file must be regenerated when the Books change. In practice a fixed classical text does not change, and `markup.test.mjs` already fails loudly if the entry count moves. §6 adds a test that fails when `entries.json` and the HTML disagree, so the obligation is enforced rather than remembered.

### 4.2 `search_meditations` on `/mcp`

A second tool in `functions/mcp.js`:

```
name: "search_meditations"
description: Search the 499 entries of Marcus Aurelius' Meditations (Books 1–12,
             Gregory Hays translation) and return matching entries with deep links.
inputSchema: { query: string }   // "a phrase, or an entry number such as 4.3"
annotations: { readOnlyHint: true }
```

`execute` fetches `https://vreeman.com/entries.json` once per isolate (edge-cached; `Cache-Control: public, max-age=3600` in `_headers`, matching the other generated artifacts), then runs `findMatches` + `snippet`. Results are capped — 20 entries, with a line saying how many more matched — because an unbounded match on a common word would return most of the book.

Each result line carries a **citable URL**:

```
4.3 — …retreats for themselves, country cottages, beaches… — https://vreeman.com/meditations/#book4-3
```

Declared in `.well-known/mcp/server-card.json`; `node tools/ards/build.mjs` regenerates `ai-catalog.json`, whose `capabilities` array picks up `search_meditations` beside `search_content`.

### 4.3 The same tool in WebMCP

Registered on the Meditations page under **the identical name and input schema**, as the WebMCP spec asks, so an agent that knows the server-side tool recognises the browser one immediately.

In the browser it needs no fetch and no `entries.json`: `search.js` already exports `buildIndex`, and the page has usually built the index already. `execute()` is a thin call into existing site functionality, which is what the spec asks a tool to be.

Following the spec's first implementation rule — *feature-detect before you download, not just before you register* — the Meditations page carries a few inline bytes that check for `modelContext` and only then inject the registration module. A visitor whose browser has no WebMCP implementation downloads nothing.

### 4.4 Alternative considered and rejected

WebMCP only: no generator, no `entries.json`, no server-side tool. Smaller footprint and no sync obligation, but it reaches only agents running inside a browser that has shipped the API — today, almost none — and leaves finding 10 unaddressed. Rejected on reach, with the smaller option offered and declined at design time.

## 5. Component B — agent-surface modernisation

### 5.1 MCP 2026-07-28 in `functions/mcp.js`

MCP's 2026-07-28 revision removes the `initialize` handshake: every request declares its own protocol version, sessions and the standalone `GET` stream are gone, and `server/discover` becomes mandatory. The endpoint must serve both eras from one URL, because older clients open with a handshake and cannot fall forward when it is refused.

- Add `server/discover`, returning server info, capabilities and instructions.
- Accept a per-request `protocolVersion`; add `2026-07-28` and make it `LATEST_PROTOCOL_VERSION`.
- Keep `initialize` working, and answer it with `Deprecation` and `Sunset` response headers announcing this site's own support window — the `deprecation-and-sunset` case of announcing a window for something a standard has moved past but never scheduled for removal.
- `.well-known/mcp/server-card.json` gains `2026-07-28` in `supportedProtocolVersions`.

### 5.2 WebMCP detection — and why the two pages differ

Two authorities disagree here, and the disagreement is real rather than a misreading.

The spec says: detect `document.modelContext` first, never install a stand-in, and guard the *load* so a browser without the API downloads nothing.

**isitagentready.com evaluates `checks.discovery.webMcp` at runtime, in a headless browser that has no native WebMCP API.** Its evidence string reads "No tools registered via `navigator.modelContext`". The homepage's inline shim exists precisely so the tool stays detectable in that browser; the check was confirmed passing live on 2026-06-02 (commit `a0ac52c`), which is also what proved the scanner runs a browser at all. Removing the shim, or putting the homepage bundle behind a load guard, would each independently fail a check this site already passes.

So the two pages get different treatment, for a stated reason:

- **`index.html` — the scanned surface. Keep the inline script, keep the shim.** The only change is to consult `document.modelContext` before `navigator.modelContext`, so that a browser which really ships the API wins over the shim. The shim continues to install only when neither exists, and never overwrites a native implementation.
- **`meditations/index.html` — not the scanned surface.** Follows the spec cleanly: guard the load, no shim, `document.modelContext` first.

The cost of the shim is the one the spec names — it makes the API look present to other code on the homepage. That is accepted knowingly, in exchange for a check that is currently green, and it is confined to one page. Revisit if a major browser ships WebMCP unflagged, or if isitagentready.com starts detecting `document.modelContext`.

## 6. Component C — discovery fixes

### 6.1 Advertise `/llms.txt` — finding 4

In `_headers`, extended onto the existing site-wide `Link` header:

```
Link: </llms.txt>; rel="describedby"; type="text/markdown"
```

and in the head of the main pages:

```html
<link rel="describedby" href="https://vreeman.com/llms.txt" type="text/markdown">
```

Both, deliberately: the header reaches agents that never parse HTML, the element reaches those that only parse HTML. Without either, `/llms.txt` is found only by an agent that already guessed the path — the exact failure v2 set out to fix.

### 6.2 `/.well-known/agent-skills` — finding 8

A skills index listing what an agent should know to work with this site, including the two search tools from §4. The spec's own WebMCP page asks for registered tools to be documented here so that agents reading the discovery surfaces — not just ones already in a browser — learn they exist. Emerging Cloudflare-led RFC, still draft; served with `Access-Control-Allow-Origin: *` like the other well-known JSON.

### 6.3 `tdm-reservation: 0` — finding 9

A site-wide response header in `_headers`. TDMRep governs whether what a bot fetched may be **mined**, which `robots.txt` does not speak to; under Article 4 of the EU copyright directive a reservation that is not machine-readable does not count at all. `0` declines to reserve — the honest counterpart to this site's CC BY 4.0 licence and its existing `Content-Signal: ai-train=yes`.

## 7. Component D — Meditations metadata corrections

Two defects found while reading the graph. Neither involves `SearchAction`.

**D1 — `og:url` is not canonical.** `meditations/index.html` line 430 sets

```
og:url = https://vreeman.com/meditations/?utm_source=social&utm_medium=organic&utm_campaign=share
```

while `<link rel="canonical">` is clean. Every share advertises a non-canonical URL, and anything treating `og:url` as the identity of the page — including agents building a link graph — records the tagged one. Fix to the canonical URL. Campaign attribution for shares belongs in the share link, not in the page's own statement of what it is.

**D2 — the `WebSite` node has two different `@id`s.** `meditations/index.html` uses `@id: "https://vreeman.com/"`; `index.html` and `schema.json` use `@id: "#website"`. One entity with two identifiers cannot be merged across pages by anything consuming the graph. Settle on the absolute form, `https://vreeman.com/#website`, and apply it in all three places — relative `@id`s resolve against the containing page, so `#website` means a different node on every URL that uses it.

## 8. Testing

Entry point stays `node --test tools/meditations-search/test/*.test.mjs`.

- **`index.test.mjs`** (new) — the generated `entries.json` has 499 entries; its labels match the markers `markup.test.mjs` counts in the HTML; a phrase known to be inside the Books resolves to the expected entry; one known to be outside them (`Hays`, `Loeb`) resolves to nothing. This is the test that makes the §4.1 sync obligation enforced rather than remembered.
- **`build-index.test.mjs`** (new) — the HTML→items scanner against small fixtures: a Book 1 `<h3>` marker, a Books 2–12 `<strong>` marker, a lettered sub-entry, a continuation `<p>`, an excluded `<sup>` and `.return`.
- **`tools/mcp/test/dispatch.test.mjs`** (new) — `server/discover`, a per-request `protocolVersion`, a legacy `initialize` still answering, `tools/list` carrying both tools, and `tools/call` for `search_meditations` against a stub corpus.
- Existing `search.test.mjs`, `dom.test.mjs` and `markup.test.mjs` must stay green; §4 adds exports but changes no shipped behaviour.

Manual verification, per the spec's own checklists:

- `curl -sI https://vreeman.com/ | grep -i '^link:'` shows `rel="describedby"`, and `tdm-reservation: 0`.
- On a browser without WebMCP, the network panel shows **no request** for the tool bundle — not a request whose script returns early.
- `typeof document.modelContext?.registerTool === 'function'` on a supporting browser, and the agent UI lists `search_meditations`.
- The Rich Results Test on `/meditations/` still parses the graph after D1 and D2.

## 9. Out of scope — backlog

Recorded here so they are documented rather than forgotten.

- **`SearchAction`** — blocked on `?q=` URL state, declined at design time. Revisit only if the search gains history support.
- **OKF v0.2** (finding 7) — v0.2 moves provenance and lifecycle into front matter. Touches `tools/okf/build.mjs`, the bundle, and the `version` in the ARD catalog. Its own piece of work.
- **Per-page Markdown source endpoints** (finding 10) — a `.md` sibling for each Stoic-library page, advertised with `rel="alternate"; type="text/markdown"`. Sizeable; interacts with `llms.txt` v2's path scoping and with `Vary`.
- **`No-Vary-Search`** — only relevant if `?q=` is ever added.

### Found while implementing, 2026-09-17

Everything below was verified against the working tree on 2026-09-17 and is recorded with enough
detail to act on without the conversation that found it. None of it is a regression from this branch.

#### B1 — Two unfilled Seneca template stubs, one of them advertised in `llms.txt`

`seneca/letter-124.html` and `seneca/letter-.html` are both tracked, both unfilled copies of the
letter template:

- `letter-124.html`: `<title>📗 Letter X: - Seneca</title>`, `<h1>Letter X: </h1>`, an empty `<p>`,
  empty `description`/`og:title`/`og:image`/`books:isbn`, one dangling `fn-1` footnote.
- `letter-.html`: `<title>📗 Letter :  - Seneca</title>`, otherwise near-identical. It looks like a
  stray — a template instantiated with no number at all.
- **Both declare the same canonical**, `https://vreeman.com/seneca/letter-`, and the same `hreflang`
  pair and `og:url`. Two pages claiming one identity, and that identity is not a real URL.
- Neither is in `sitemap.xml`; neither is linked from `seneca/index.html` (which lists letters 1–66
  and 90 — 67 letters).
- **But `llms.txt:140` advertises `- [Letter 124: On the True Good as Attained by Reason - Seneca](https://vreeman.com/seneca/letter-124)`.**
  The site's own agent index points an agent at a placeholder. That is exactly the failure the
  llms.txt spec calls out: a stale `llms.txt` is worse than none, because it teaches models wrong
  things rather than nothing.

`tools/og-url/build.mjs` reports `letter-124.html` as its one `NOTE` and deliberately does not
overrule the canonical; `letter-.html` draws no note, because its canonical happens to match what its
filename implies. **Fix:** finish or delete both, and reconcile `llms.txt`.

**The `llms.txt` problem is bigger than letter 124.** Cross-checking every `vreeman.com` link in
`llms.txt` against `git ls-files` on 2026-09-17: **146 links, 56 with no tracked page** — Seneca
letters 67–89 and 91–123. `llms.txt` was written against the full 124-letter corpus while only 66
letters (plus 90, plus the 124 stub) have been published. The repo owner has `seneca/letter-67.html`
in progress in the working tree, so this is being filled in letter by letter; the index is simply
running ahead of the content. Decide which way to close the gap — publish, or trim `llms.txt` to what
exists and re-add entries as letters ship — and consider a test that fails when `llms.txt` names a
page `git ls-files` does not have, which would make this self-enforcing.

#### B2 — 18 pages have a canonical and no `og:url` at all

`tools/og-url/build.mjs` skips these without a word: inventing a tag is a different change from
repairing one. Verified counts, 2026-09-17:

- **11 canonicalise to `https://vreeman.com/`** and look deliberate — utility pages with no identity
  of their own: `404.html`, `beta.html`, `bookmarklets.html`, `calc.html`, `dashboard.html`,
  `dencoder.html`, `growth.html`, `percentage.html`, `realtime.html`, `search.html`, `tools.html`.
  A self-referential `og:url` on these would be wrong; leaving the tag off is defensible. (`beta.html`
  is the repo owner's uncommitted work — leave it alone.)
- **`boilerplate.html`** canonicalises to **`https://vreeman.com`** — no trailing slash, the only page
  that spells the homepage that way. See B4.
- **6 are real content with a self-canonical and no `og:url`**, so they share naked — a platform has
  nothing to canonicalise against and falls back to whatever URL the sharer handed it, tracking
  parameters included. This is the same defect the 76 empty `og:url` pages had, in a different shape:
  `meditations/quotes.html`, `okf/index.html`, `ithaca.html`, `cowboy-song.html`, `drunk.html`, and
  `entitymap/vocab/v1/index.html` (the last is the hand-maintained vocabulary documentation page the
  EntityMap spec requires to resolve at its namespace URI — lowest priority of the six, since nobody
  shares it, but it is still a page with an identity and no statement of it).

Adding `<meta property="og:url">` to those 6 is the actionable half. `tools/og-url/build.mjs` would
then keep them correct forever, and `og-url.test.mjs` already checks any page that has both tags.

#### B3 — 3 pages have no `<link rel="canonical">` at all

`chi.html`, `entitymap.html`, `test.html`. `entitymap.html` is generated by
`tools/entitymap/build.mjs`, so its fix belongs in `lib/render-html.mjs`, not in the file.

#### B4 — `boilerplate.html`'s canonical is `https://vreeman.com`, with no trailing slash

`boilerplate.html:67`. Every other page spells the homepage `https://vreeman.com/`. As a bare origin
with an empty path the two are equivalent under RFC 3986 §6.2.3, but nothing downstream is obliged to
normalise, and this is the template other pages get copied from — so the odd spelling propagates.
Make it `https://vreeman.com/`.

#### B5 — Dangling JSON-LD reference in the Meditations graph

`meditations/index.html:837` — Book 7's node carries
`"hasPart": { "@id": "https://vreeman.com/meditations/#book7-56" }`, and **no node in the graph
defines `#book7-56`**. Its three siblings do: `#book2-11`, `#book5-20` and `#book10-16` are
referenced at lines 756/804/885 and defined at 1215/1227/1239.

This is a **missing node, not a bad href** — the HTML anchor `<strong id="book7-56">` exists at line
2301 and resolves fine in a browser. A consumer merging the graph gets an `@id` reference to an
entity with no type, name, `url` or text. **Fix:** add the fourth node beside the other three,
modelled on them.

#### B6 — Unescaped `&` in attributes, in the pages that used to carry UTM in `og:url`

The 5 pages de-tagged in commit `47a54da` shipped `content="…?utm_source=social&utm_medium=organic…"`
— a bare `&`, not `&amp;`. Moot for `og:url` now, but it pointed at a habit rather than one typo.

Scanning every tracked page for a `&` inside a double-quoted attribute that does not begin a valid
character reference, 2026-09-17:

- **`index.html`** — 6 attributes: lines 247, 255 and 272 (`name="description"`,
  `property="og:description"`, `name="twitter:description"`, all `Growth & Technical Marketing
  Advisor … insights & data`), and lines 664, 669, 740 (`title=` attributes on outbound links).
  Line 740 is instructive: the link's *text* is correctly `Coffee &amp; Wine` while its `title` is
  `Coffee & Wine`, so the escaping was known and just not applied in the attribute.
- **`utm.html`** — lines 218–220, three `href="…&num=1&hl=en&gl=en&strip=0&vwsrc=0"` Google Cache URLs.
- **Nothing else.** The other four de-tagged pages (`discourses/index.html`,
  `discourses/enchiridion.html`, `discourses/fragments.html`, `discourses/george-long.html`) and
  `meditations/index.html` are clean, so the summary "the same bug likely exists on those pages" held
  only for `index.html`.

HTML5 parsers recover from all of these, so nothing is visibly broken; it matters because the site's
own `description` and `og:description` are what an agent or a social card reads, and because a
character reference that *does* parse — `&num;` is `#`, `&amp` is `&` — turns a tolerated mistake
into a wrong value. Escape them.

#### B7 — `meditations/entries.json` is discoverable only by reading a tool description

The corpus is served correctly (`_headers` gives it `application/json`, `Access-Control-Allow-Origin: *`
and `max-age=3600`), but it is **in no sitemap and advertised by no `Link` header**. An agent finds it
only via the `search_meditations` tool description or `SKILL.md` — that is, only after it has already
found one of the other surfaces. It was justified in §4.1 as satisfying `machine-readable-formats` on
its own merits, and on its own merits it is currently unfindable.

Cheapest fix: a `Link: </meditations/entries.json>; rel="alternate"; type="application/json"` scoped
to `/meditations/*` in `_headers`, and/or a `<link rel="alternate">` in that page's head. Adding it to
`sitemap.xml` is the weaker option — sitemaps are for pages.
