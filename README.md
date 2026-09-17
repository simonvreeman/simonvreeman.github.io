[Vreeman.com](https://vreeman.com)
======================
The Personal Website of [Simon Vreeman](https://vreeman.com).

With a list of [CRO tools](https://vreeman.com/cro):
* [Google Analytics UTM Campaign URL Builder](https://vreeman.com/utm)
* [Experiment Hypothesis Builder](https://vreeman.com/hypothesis)
* [Meditations by Marcus Aurelius.](https://vreeman.com/meditations/)
* [Arrian’s Discourses of Epictetus.](https://vreeman.com/discourses/)

Build tooling
-------------
Static site, no `package.json` and no dependencies. Node 24 and the built-in `node:test` runner.

    node --test tools/*/test/*.test.mjs

Several files are **generated and must never be hand-edited** — a manual change is overwritten by the
next build, or breaks a checksum. Each generator has a README next to it explaining what it derives
its output from and why.

| Run | Writes |
|---|---|
| `node tools/entitymap/build.mjs` | `entitymap.json`, `entitymap.html` |
| `node tools/okf/build.mjs` | the whole `okf/` tree, `okf.tar.gz` |
| `node tools/ards/build.mjs` | `.well-known/ai-catalog.json`, `.well-known/did.json` |
| `node tools/meditations-search/build-index.mjs` | `meditations/entries.json` |
| `node tools/agent-skills/build.mjs` | `.well-known/agent-skills/index.json` |
| `node tools/og-url/build.mjs` | the `og:url` tag of every tracked page, from its canonical |

All six are idempotent. The one expected diff on a clean re-run is `ai-catalog.json`'s `updatedAt`,
which `buildCatalog()` restamps by design; revert it with `git checkout` if nothing else changed.

`tools/mcp/` holds no generator — it is the README and tests for `functions/mcp.js`, the Cloudflare
Pages Function serving <https://vreeman.com/mcp>.

Design and implementation notes live in [`docs/plans/`](docs/plans/).