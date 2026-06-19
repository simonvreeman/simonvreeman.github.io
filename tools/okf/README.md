# OKF bundle build tooling

Generates the site's [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/HEAD/okf/SPEC.md)
v0.1 bundle at `/okf/` — a directory of Markdown concept files mirroring the EntityMap entities.

## Regenerating

    node tools/okf/build.mjs

Reads the SAME source data as the EntityMap (`tools/entitymap/data/*.mjs` + `bootstrap-letters.mjs`),
maps each entity to one `.md` file, validates OKF v0.1 conformance, then **wipes and rewrites** `/okf/`.
**The entire `/okf/` tree is GENERATED — never hand-edit it.** Edit the EntityMap data and rebuild.

## Mapping

- `@type` → frontmatter `type` (the custom `…#Work` type becomes the bare string `Work`).
- `relations` → `## Related` markdown links; the predicate becomes the linking verb (OKF links are untyped).
- `hasChunks` → verbatim `## Examples` blockquotes + numbered `## Citations`.
- Links are relative so they resolve for both OKF-aware agents and plain browsers.

## Status

OKF is **v0.1 (Draft)**, "not an official Google product." Showcase only; re-validate when it leaves draft.

## Tests

    node --test tools/okf/test/*.test.mjs
