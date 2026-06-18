# EntityMap build tooling

This directory generates the site's [EntityMap](https://entitymap.org/spec/v1.0): the machine-readable `/entitymap.json` and the human-readable `/entitymap.html` at the repository root.

## Regenerating

```sh
node tools/entitymap/build.mjs
```

This reads the source data in `tools/entitymap/data/` (publisher identity, custom vocabulary, named entities, and works) together with the Seneca letter pages under `/seneca/`, validates the result, and writes both `entitymap.json` and `entitymap.html` to the repo root.

`entitymap.html` is **GENERATED**. Never hand-edit it — any manual change is overwritten on the next build. Edit the data files (or the renderer in `lib/render-html.mjs`) and rebuild instead.

## Publisher identity

The publisher identity lives in **one place only**: `data/publisher.mjs`. It is currently `{ name: 'Vreeman.com', url: 'https://vreeman.com/' }`.

If the live EntityMap validator rejects `"Vreeman.com"` (the spec prefers a brand over a domain) after the 2026-07-01 launch, change `name` to `"Simon Vreeman"` in `data/publisher.mjs` and rebuild. Do not edit the publisher anywhere else.

## Custom vocabulary

The EntityMap declares a custom type `Work` and a custom predicate `TRANSLATED_BY`, namespaced at `https://vreeman.com/entitymap/vocab/v1`. The spec requires custom terms to resolve at their namespace URI, so the documentation page lives at `/entitymap/vocab/v1/index.html` and must be kept in sync with `data/vocabulary.mjs`.

## Discovery

Discovery is intentionally minimal: `/robots.txt` advertises the EntityMap (`EntityMap:` line) and `/sitemap.xml` lists `entitymap.html`. The Stoic content pages are not modified.

## Tests

```sh
node --test tools/entitymap/test/*.test.mjs
```

Use the glob (`*.test.mjs`) — passing the bare directory path does not recurse on this Node version, so the tests would not be found.
