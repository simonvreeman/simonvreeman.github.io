# Agent Skills discovery index

Generates `/.well-known/agent-skills/index.json` — the site's skills index, per the
[Agent Skills Discovery RFC](https://github.com/cloudflare/agent-skills-discovery-rfc) **v0.2.0**.
The skills themselves are hand-written: one directory per skill under `.well-known/agent-skills/`,
each holding a `SKILL.md`. Only the index is generated.

## Regenerating

    node tools/agent-skills/build.mjs
    OK  1 skill → .well-known/agent-skills/index.json

**`index.json` is GENERATED — never hand-edit it.** Adding a skill means adding a directory with a
`SKILL.md` and re-running this; there is no list of skills to keep in sync here. `readdirSync()`
order is filesystem-dependent, so entries are sorted by name — without that the same tree can produce
two different byte streams on two machines and the committed index churns for nothing.

## Why it is generated at all

One reason: **every entry carries a SHA-256 digest of the `SKILL.md` it points at, and a conformant
client MUST refuse content whose hash does not match.** A hand-maintained digest goes stale the first
time someone fixes a typo in the body, and the skill then fails closed everywhere, silently, for
everyone — the agent does not report a bad hash to the site owner. Deriving the digest from the bytes
on disk makes that impossible.

`test/digest.test.mjs` then re-checks the shipped file, so a build that was never re-run is a red
test rather than a broken index in production. That is the same shipped-vs-generated ratchet
`tools/og-url` uses.

`bytes` stays a `Buffer` all the way to the digest. Hashing a decoded string would hash whatever
re-encoding Node chose, and for any non-ASCII byte — or a file with a BOM or CRLF endings — that is a
different hash from the one a client computes over the response body. The RFC is explicit that the
digest covers "the raw bytes of the skill's artifact", and this file has an em dash and a `–` in it.

## What the generator validates

It throws rather than writing a bad index, and refuses to write an empty one:

- `SKILL.md` has YAML frontmatter, anchored to byte 0 — a `---` later in the body is a horizontal
  rule, not a delimiter.
- Frontmatter carries both `name` and `description`.
- The declared `name` equals the directory name. The spec requires it, and the RFC's `url` is built
  from the directory: if they disagree, an agent selects on one identity and loads a file claiming
  another.
- `name` matches `^[a-z0-9]+(-[a-z0-9]+)*$` and is at most 64 characters
  ([agentskills.io/specification](https://agentskills.io/specification)).
- `description` is at most 1024 characters. It is the only thing most agents ever read.

## Field choices

- **`type: "skill-md"`** — every skill here is a lone `SKILL.md`. `"archive"` is for skills bundling
  scripts or references, which would cost an agent a download and an unpack it does not need.
- **`url` is path-absolute** (`/.well-known/agent-skills/<name>/SKILL.md`), resolved against the index
  URL per RFC 3986 §5. A fully-qualified `https://vreeman.com/…` would be wrong on a preview deploy
  or a mirror, which serve the same index from another origin.
- **`$schema`** is an opaque identifier, not a document to fetch: the RFC has clients match it
  against schema URIs they know and refuse an index whose version they do not recognise.

## Serving it — `_headers`

Both `Content-Type`s are a **MUST** in the RFC, so neither is left to what Pages would infer: an
index that is not `application/json`, or a `SKILL.md` that arrives as `text/html`, is a skill a
conformant client refuses.

    /.well-known/agent-skills/index.json
        Content-Type: application/json
        Access-Control-Allow-Origin: *
        Cache-Control: public, max-age=3600
    /.well-known/agent-skills/*/SKILL.md
        Content-Type: text/markdown; charset=utf-8
        Access-Control-Allow-Origin: *

**There is deliberately no `Cache-Control` on `SKILL.md`.** Each index entry carries a SHA-256 of
that file, and a cached `SKILL.md` outliving the index that describes it is a digest mismatch — which
clients MUST treat as tampering. The index's own hour matches the rest of the machine-readable
surfaces here.

## Advertised by a `Link` header

The site-wide `Link` in `_headers` carries
`</.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"`.

That relation is a **deliberate divergence**, recorded in `_headers` itself and in commit `1757ac0`:
[specification.website](https://specification.website/) recommends this exact spelling, but the
Cloudflare RFC defines no link relation at all — it is well-known-URI only — and `agent-skills` is
not in the IANA registry, so RFC 8288 §2.1.2 would want a URI here. The bare token is kept anyway,
because the token is what any client following that advice looks for, and a conformant URI nothing
searches for would be worse. Revisit if it is ever registered.

## The one skill

`vreeman-stoic-library` — how to look up, search, quote and cite the *Meditations*: the
`search_meditations` MCP tool at `https://vreeman.com/mcp`, the same tool under the same name via
WebMCP on `/meditations/`, the whole corpus at `/meditations/entries.json`, and the
`#book<book>-<entry>` anchor form for citations. It ends by pointing at `/llms.txt` for the rest of
the library (Epictetus, Seneca, Stockdale), which has no search tool.

Its content is checked by reading it: nothing in this repo can verify that the tool behaves as the
skill promises. What the tests do hold is that the index and the file agree.

## Tests

    node --test tools/agent-skills/test/*.test.mjs

14 tests in `digest.test.mjs`. The one that matters most is the cheap one — hash the bytes on disk
and compare — plus `the shipped index is what the generator produces now`. The rest cover the RFC's
normative requirements on an entry: exactly two top-level fields, exactly five per entry,
`type`/`url` shape, path-absolute urls, `sha256:` + 64 lowercase hex, the naming spec, uniqueness,
the 1024-character cap and description-matches-frontmatter, name-matches-directory, and that
`buildIndex()` is deterministic.
