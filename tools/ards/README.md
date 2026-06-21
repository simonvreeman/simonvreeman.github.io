# ARDS catalog build tooling

Generates the site's [Agentic Resource Discovery](https://agenticresourcediscovery.org/) capability catalog:
the machine-readable `/.well-known/ai-catalog.json` and the `did:web:vreeman.com` document at
`/.well-known/did.json`.

## Regenerating

    node tools/ards/build.mjs

Reads `.well-known/mcp/server-card.json` and the shared `tools/entitymap/data/publisher.mjs`, validates,
and writes both files. **Both are GENERATED — never hand-edit.**

## Entries

Two entries, both carrying `type` (ARD layer) and `mediaType` (base ai-catalog spec) with identical
values, since the two specs disagree on the field name:
- the live MCP server (`urn:ai:vreeman.com:mcp:site-search` → `.well-known/mcp/server-card.json`); and
- the OKF knowledge bundle (`urn:ai:vreeman.com:okf:stoicism` → `/okf.tar.gz`), so ARD provides the
  discovery layer OKF deliberately omits (per joost.blog/okf-ard).

## Watch-items (single constants in `lib/constants.mjs`)

- `MCP_MEDIA_TYPE` is the spec value `application/mcp-server+json`; the only live ARDS catalog in the wild
  uses `application/mcp-server-card+json`. Flip if a validator rejects it.
- `OKF_MEDIA_TYPE` (`application/okf-bundle+gzip`) is unregistered — the string Joost de Valk proposed and
  filed upstream. Flip if/when an official type is registered.
- `host.displayName` comes from `publisher.mjs` (`Vreeman.com`) — brand-vs-domain is the same watch-item as
  the EntityMap publisher name.

## Status

ARDS is **v0.9 (Draft)** with a stale schema `$id`. Treat as a showcase; re-validate when the spec leaves draft.

## Tests

    node --test tools/ards/test/*.test.mjs
