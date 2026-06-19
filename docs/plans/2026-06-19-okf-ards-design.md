# OKF bundle + ARDS catalog for vreeman.com (Stoicism) — Design

- **Date:** 2026-06-19
- **Status:** Approved (brainstorming complete; implementation plan to follow)
- **Author:** Simon Vreeman (with Claude Code)
- **Scope:** Add two more agent-readiness showcase artifacts beside the existing [EntityMap](2026-06-18-entitymap-design.md): an **Open Knowledge Format (OKF)** content bundle for the Stoicism library, and an **Agentic Resource Discovery (ARDS)** capability catalog. Both generated from existing single sources of truth.

---

## 0. The central finding (why this is two things, not one)

The prompt framed ARDS and OKF as one Google announcement. They are **two separate, unrelated specs** and only one is "by Google" in the strong sense:

- **ARDS — Agentic Resource Discovery** (`github.com/ards-project/ard-spec`, `agenticresourcediscovery.org`). Announced on the Google Developers Blog 2026-06-17 (Junjie Bu, Srinivas Krishnan, Alan Blount, Antonio Gulli — all Google). Apache-2.0. **`v0.9 (Draft)`** (the manifest field reads `specVersion: "1.0"` while the spec is 0.9; the JSON Schema `$id` still points at a stale `Agent-Card/agentfinder` path → recent rename, churn risk). Catalogs **callable capabilities** (MCP servers, A2A agent cards, Skills, APIs), not content. Domain ownership = cryptographic root of trust.
- **OKF — Open Knowledge Format** (`github.com/GoogleCloudPlatform/knowledge-catalog/okf/SPEC.md`). **Explicitly "not an official Google product."** Apache-2.0, **`v0.1 (Draft)`**. A **content** format: a directory of Markdown files with YAML frontmatter. No JSON, **no MIME type, no `/.well-known/` path, no discovery mechanism**. Serving at `/okf/` + an `llms.txt` pointer is a *practitioner convention* (Suganthan Mohanadasan), not the spec.

Neither references the other. The only place they meet is one practitioner's site, which ships both independently. Mapped onto vreeman.com they land on different layers: **OKF re-expresses the Stoic content** (the EntityMap sibling); **ARDS indexes the site's existing capabilities** (the live `/mcp`, `.well-known/mcp/server-card.json`, WebMCP). Honest framing from the practitioner: "A bundle will not move your rankings or your AI visibility this week." Both are adopted here as **deliberate showcases**, same as EntityMap.

## 1. Decisions (locked)

| Decision | Choice |
|---|---|
| Scope | **Both** OKF + ARDS, generated from **shared sources** |
| OKF granularity | **All ~102 entities** — one `.md` per EntityMap entity, incl. all ~68 Seneca letters |
| ARDS identity/trust | **`did:web:vreeman.com` + light trust** — publish a minimal `/.well-known/did.json`; `trustManifest` carries identity only (no attestations / no signature) |
| Architecture | **Static Node generators**, committed; OKF reuses `tools/entitymap/data`; both validate-then-write |
| `publisher` / `host.displayName` | **`Vreeman.com`** (single-sourced from `tools/entitymap/data/publisher.mjs`; see §6) |
| Content pages | **No edits** to the ~150 Stoic HTML pages (same restraint as EntityMap) |

## 2. OKF bundle — the Stoic content layer

Served at **`/okf/`**, generated from the **same** `tools/entitymap/data/*.mjs` (concepts/persons/works) + `tools/entitymap/lib/bootstrap-letters.mjs`, so it cannot drift from the EntityMap.

### 2.1 Bundle layout
```
/okf/
  index.md          # bundle root. Only frontmatter permitted in any index.md: okf_version: "0.1".
  log.md            # ## 2026-06-19  →  * **Initialization**: …
  concepts/  index.md + 10 concept .md
  persons/   index.md + 12 person .md
  works/     index.md + ~13 work .md (incl. moral-letters.md, stockdale collection, essays)
  seneca/    index.md + ~68 letter-N.md   # mirrors the site's /seneca/letter-N paths
```
- `index.md` files: **no frontmatter** (except the bundle-root `index.md`, which carries only `okf_version: "0.1"`). Body = `* [Title](relative-url.md) - description` grouped under `#` headings; subdir entries link to `concepts/` etc.
- `log.md`: date-grouped newest-first, `## YYYY-MM-DD` ISO headings.
- Reserved filenames `index.md` / `log.md` are never used for concepts.

### 2.2 Entity → Concept mapping (one `.md` per entity)

| EntityMap field | OKF target |
|---|---|
| `@type` (`Concept`/`Person`/custom `Work`) | frontmatter `type` (free string — the custom `Work` survives verbatim) |
| `name` | frontmatter `title` + body `#` heading |
| `description` | frontmatter `description` + intro prose |
| `sameAs` (Wikidata) | `resource` (canonical URI); also kept as a custom `sameAs:` key (OKF consumers preserve unknown keys) |
| `relations[]` `{predicate,targetName,targetId}` | `## Related` markdown links; the predicate becomes the **linking verb in prose** (OKF links are untyped — the one place fidelity drops) |
| `hasChunks[]` (verbatim ≤600-char) | `## Examples` `> blockquote` (verbatim) → numbered `## Citations` (`[n] [pageTitle](sourceUrl)`) |

**`resource` rule:** Works/letters → the canonical `vreeman.com` page (chunk `sourceUrl`); Persons/Concepts → the Wikidata `sameAs` when present, else the primary chunk `sourceUrl`.

**Required-field conformance:** every non-reserved `.md` has parseable frontmatter with a **non-empty `type`** (the only OKF requirement). `title/description/resource/tags/timestamp` are recommended-only.

**Link style:** **relative** links (`../works/meditations.md`, `./philosophy.md`), not bundle-absolute `/…`. OKF permits both; relative links resolve for an OKF-aware agent *and* a plain browser, and "stability when docs move" is moot for generated files.

### 2.3 Sample (`concepts/stoicism.md`)
```markdown
---
type: Concept
title: Stoicism
description: The Hellenistic school of philosophy founded in Athens by Zeno of Citium…
resource: https://www.wikidata.org/wiki/Q48235
tags: [stoicism, concept]
timestamp: 2026-06-19T00:00:00Z
sameAs: https://www.wikidata.org/wiki/Q48235
---
# Stoicism
The Hellenistic school of philosophy founded in Athens by Zeno of Citium…
## Related
- An instance of [Philosophy](../concepts/philosophy.md).
- Described by [Meditations](../works/meditations.md).
## Examples
> Of these Hellenistic systems the most important … was the Stoic school. The movement takes its name from the stoa … where its founder, Zeno of Citium (332/3–262 B.C.), taught and lectured. [1]
## Citations
[1] [📘 Meditations by Marcus Aurelius. Translation by Gregory Hays.](https://vreeman.com/meditations/)
```

### 2.4 Discovery
OKF defines none. Add an `## Open Knowledge Format` pointer in `llms.txt` to `https://vreeman.com/okf/`; an agent is handed `/okf/index.md` and walks the links.

## 3. ARDS catalog — the capability layer

`/.well-known/ai-catalog.json` indexing the site's genuine callable capabilities. One honest entry today (the live MCP server-card), structured to grow.

```json
{
  "specVersion": "1.0",
  "host": {
    "displayName": "Vreeman.com",
    "identifier": "did:web:vreeman.com",
    "documentationUrl": "https://vreeman.com/",
    "trustManifest": { "identity": "did:web:vreeman.com", "identityType": "did" }
  },
  "entries": [{
    "identifier": "urn:ai:vreeman.com:mcp:site-search",
    "displayName": "Vreeman Site Search",
    "type": "application/mcp-server+json",
    "url": "https://vreeman.com/.well-known/mcp/server-card.json",
    "description": "MCP server exposing search_content over the tools + Stoic library.",
    "capabilities": ["search_content"],
    "representativeQueries": [
      "seneca letters on death",
      "epictetus dichotomy of control",
      "GA4 UTM campaign builder"
    ],
    "version": "1.0.0",
    "updatedAt": "2026-06-19T00:00:00Z"
  }]
}
```

- **`/.well-known/did.json`** (minimal) so `did:web:vreeman.com` resolves: `@context`, `id`, `alsoKnownAs: ["https://vreeman.com/"]`, and a `service` entry of type `AICatalog` pointing at the catalog. **No keypair** (identity-only trust; no detached-JWS signature).
- **Required fields honored:** root `specVersion` + `entries`; `host.displayName`; per entry `identifier` (`urn:ai:` pattern), `displayName`, `type`, and exactly one of `url`/`data`; `trustManifest.identity`.
- `host.displayName` imports `publisher.mjs` so "Vreeman.com" stays single-sourced with EntityMap.
- **A one-entry catalog is correct, not thin.** ARDS indexes *callable* resources; the site serves exactly one fetchable capability descriptor (the MCP server-card). We will **not fabricate** an A2A card or OpenAPI the site does not serve. The array grows when real capabilities appear.

## 4. Architecture (shared generators, validate-then-write)

- **`tools/okf/`** — `build.mjs` imports entities from `../entitymap/data` + `bootstrap-letters`, maps each to a `.md`, writes the `/okf/` tree + `index.md`/`log.md`. `lib/` = `entity-to-markdown.mjs`, `render-index.mjs`, `render-log.mjs`, `validate.mjs`. `test/*.test.mjs` (`node --test`). EntityMap remains the canonical entity source — no data duplication.
- **`tools/ards/`** — small `build.mjs`: reads `.well-known/mcp/server-card.json` + `publisher.mjs`, emits `.well-known/ai-catalog.json` + `.well-known/did.json`. `lib/validate.mjs` (root/entry required fields, exactly-one url/data, `urn:ai:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+` pattern, `trustManifest.identity`). `test/`.
- Both **refuse to write on any validation error**, exactly like `tools/entitymap/build.mjs`. READMEs document "run before committing"; both are under `tools/` (already `Disallow:`-ed in robots.txt and not served).

## 5. Discovery & serving changes

- **robots.txt**: add `Agentmap: https://vreeman.com/.well-known/ai-catalog.json` (beside the existing `EntityMap:` + `Content-Signal:` lines).
- **llms.txt**: add `## Open Knowledge Format` → `https://vreeman.com/okf/`.
- **`_headers`** (Cloudflare Pages): add
  - `/.well-known/ai-catalog.json` → `Content-Type: application/ai-catalog+json`, `Access-Control-Allow-Origin: *`, cache 3600 (ARDS MUSTs: HTTPS + correct Content-Type + CORS).
  - `/okf/*` → `Content-Type: text/markdown; charset=utf-8`, `Access-Control-Allow-Origin: *`.
- **index.html `<head>`**: optional `<link rel="ai-catalog" href="https://vreeman.com/.well-known/ai-catalog.json">` (parallels the existing webmention/micropub/manifest link rels).
- **sitemap.xml**: add `https://vreeman.com/okf/` (priority 0.8, weekly) — **not** the ~100 `.md` files.
- **No edits to the ~150 Stoic content pages.**

## 6. Risks & open items

1. **MCP media type** — spec/schema say `application/mcp-server+json`; the only live ARDS catalog in the wild (suganthan.com) uses `application/mcp-server-card+json`. We emit the **spec** value; single constant, flip if needed. **Re-validation checkpoint.**
2. **`host.displayName = "Vreeman.com"`** — same brand-vs-domain watch-item as EntityMap's `publisher.name`; single constant.
3. **Pre-1.0 churn** — ARDS `v0.9` (stale schema `$id`, 0.9-vs-1.0 mismatch), OKF `v0.1`. Centralize all field shapes in the generators; **re-validate when each spec leaves draft** (mirrors the EntityMap post-2026-07-01 note).
4. **DID minimalism** — `did:web:vreeman.com` with no verification method is a self-declared identity anchor (proves domain control via `/.well-known/did.json`), not a signing identity. Acceptable for an identity-only showcase; add a keypair + JWS only if a consumer ever requires it.
5. **Cloudflare Pages serving** — confirm it serves `/.well-known/*` and `.md` files (and honors the `_headers` Content-Type overrides) on the live deploy.
6. **OKF relation fidelity** — typed predicates (`TRANSLATED_BY`, `AUTHORED_BY`, …) become untyped links; the predicate lives in the link's prose verb. Inherent to OKF.

## 7. Phasing

- **Phase 1** — ARDS: `tools/ards/` generator + `ai-catalog.json` + `did.json` + `_headers` + robots `Agentmap:` + tests. Small, self-contained, ships first.
- **Phase 2** — OKF: `tools/okf/` generator + full `/okf/` bundle (all ~102) + `index.md`/`log.md` + validation/tests + `llms.txt` + sitemap entry.
- **Phase 3** — validate both (locally + on the live deploy); record the post-draft re-validation obligation in memory.

## 8. References

- ARDS spec: https://agenticresourcediscovery.org/spec/ · repo: https://github.com/ards-project/ard-spec · schema: `spec/schemas/ai-catalog.schema.json`
- ARDS announcement: https://developers.googleblog.com/announcing-the-agentic-resource-discovery-specification/
- OKF spec: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/HEAD/okf/SPEC.md
- OKF practitioner explainer + live bundle: https://suganthan.com/blog/open-knowledge-format/ · https://suganthan.com/okf/ · live catalog: https://suganthan.com/.well-known/ai-catalog.json
- Sibling: EntityMap design `docs/plans/2026-06-18-entitymap-design.md`
