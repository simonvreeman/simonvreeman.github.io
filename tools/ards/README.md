# ARDS catalog build tooling

Generates the site's [Agentic Resource Discovery](https://agenticresourcediscovery.org/) capability catalog:
the machine-readable `/.well-known/ai-catalog.json` and the `did:web:vreeman.com` document at
`/.well-known/did.json`.

## Regenerating

    node tools/ards/build.mjs

Reads `.well-known/mcp/server-card.json` and the shared `tools/entitymap/data/publisher.mjs`, validates,
and writes both files. **Both are GENERATED — never hand-edit.**

## Watch-items (single constants in `lib/constants.mjs`)

- `MCP_MEDIA_TYPE` is the spec value `application/mcp-server+json`; the only live ARDS catalog in the wild
  uses `application/mcp-server-card+json`. Flip if a validator rejects it.
- `host.displayName` comes from `publisher.mjs` (`Vreeman.com`) — brand-vs-domain is the same watch-item as
  the EntityMap publisher name.

## Status

ARDS is **v0.9 (Draft)** with a stale schema `$id`. Treat as a showcase; re-validate when the spec leaves draft.

## Tests

    node --test tools/ards/test/*.test.mjs
