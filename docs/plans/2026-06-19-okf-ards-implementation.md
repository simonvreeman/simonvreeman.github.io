# OKF Bundle + ARDS Catalog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two agent-readiness showcase artifacts to vreeman.com — an ARDS capability catalog (`/.well-known/ai-catalog.json` + `did.json`) indexing the live MCP server, and an OKF v0.1 Markdown knowledge bundle at `/okf/` mirroring all ~102 EntityMap entities — both produced by committed, validated Node generators.

**Architecture:** Two static Node generators under `tools/` (not served), mirroring the existing `tools/entitymap/` pattern (load → assemble → **validate, refuse to write on error** → emit). OKF reuses `tools/entitymap/data/*.mjs` as the single source of truth for entities; ARDS reuses `tools/entitymap/data/publisher.mjs` and reads `.well-known/mcp/server-card.json`. No npm dependencies, no build step (Cloudflare Pages serves static files).

**Tech Stack:** Node.js ESM (`.mjs`), `node --test`, plain `fs`/`path`. No third-party packages.

**Design doc:** `docs/plans/2026-06-19-okf-ards-design.md`. Branch: `okf-ards`.

**Conventions carried from EntityMap:**
- Run tests with the glob: `node --test tools/<tool>/test/*.test.mjs` (a bare dir does not recurse on this Node).
- Generators live under `tools/` (already `Disallow:`-ed in robots.txt); generated artifacts are committed at their served paths.
- `publisher.mjs` is `{ name: 'Vreeman.com', url: 'https://vreeman.com/' }` — the single identity source.

**Verified facts (do not re-derive):**
- Entity id prefixes: `concept-*`, `person-*`, `work-*`, `seneca-letter-<n>`.
- `WORK_TYPE = 'https://vreeman.com/entitymap/vocab/v1#Work'` (from `data/vocabulary.mjs`) → OKF frontmatter `type: Work`.
- Predicates in use: `INSTANCE_OF, PART_OF, AUTHORED_BY, TRANSLATED_BY, DESCRIBED_BY, RELATES_TO, PRECEDES`.
- Counts: 10 concepts, 12 persons, 13 works, ~68 Seneca letters (bootstrapped from `seneca/letter-*.html`).
- Entity shape: `{ entityId, '@type', name, description, sameAs?, relations?: [{predicate, targetId?, targetName}], hasChunks: [{chunkId, text, sourceUrl, pageTitle, publisher, contentType, relevanceScore}] }`.

---

## PHASE 1 — ARDS catalog (small, self-contained, ships first)

### Task 1: ARDS constants + validator

**Files:**
- Create: `tools/ards/lib/constants.mjs`
- Create: `tools/ards/lib/validate.mjs`
- Test: `tools/ards/test/validate.test.mjs`

**Step 1 — Write `constants.mjs`** (no test needed; pure constants):
```js
export const SPEC_VERSION = '1.0';
export const DID = 'did:web:vreeman.com';
export const CATALOG_PATH = '.well-known/ai-catalog.json';
export const DID_PATH = '.well-known/did.json';
// urn:ai:<publisher>:<namespace>:<name> — RFC 8141 domain-anchored URN
export const URN_RE = /^urn:ai:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/;
// Spec/schema value. The only live ARDS catalog in the wild (suganthan.com) uses
// 'application/mcp-server-card+json'. We emit the spec value; flip here if a validator rejects it.
export const MCP_MEDIA_TYPE = 'application/mcp-server+json';
```

**Step 2 — Write the failing test** (`test/validate.test.mjs`):
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../lib/validate.mjs';

const good = () => ({
  specVersion: '1.0',
  host: { displayName: 'Vreeman.com', identifier: 'did:web:vreeman.com', trustManifest: { identity: 'did:web:vreeman.com', identityType: 'did' } },
  entries: [{ identifier: 'urn:ai:vreeman.com:mcp:site-search', displayName: 'X', type: 'application/mcp-server+json', url: 'https://vreeman.com/.well-known/mcp/server-card.json', representativeQueries: ['a', 'b'] }],
});

test('valid catalog passes', () => {
  assert.deepEqual(validate(good()).errors, []);
});
test('bad specVersion fails', () => {
  const d = good(); d.specVersion = '0.9';
  assert.ok(validate(d).errors.some(e => /specVersion/.test(e)));
});
test('empty entries fail', () => {
  const d = good(); d.entries = [];
  assert.ok(validate(d).errors.some(e => /entries/.test(e)));
});
test('bad URN fails', () => {
  const d = good(); d.entries[0].identifier = 'mcp-site-search';
  assert.ok(validate(d).errors.some(e => /urn:ai/.test(e)));
});
test('both url and data fails (exactly-one rule)', () => {
  const d = good(); d.entries[0].data = {};
  assert.ok(validate(d).errors.some(e => /exactly one/.test(e)));
});
test('neither url nor data fails', () => {
  const d = good(); delete d.entries[0].url;
  assert.ok(validate(d).errors.some(e => /exactly one/.test(e)));
});
test('trustManifest without identity fails', () => {
  const d = good(); d.host.trustManifest = {};
  assert.ok(validate(d).errors.some(e => /trustManifest.identity/.test(e)));
});
test('representativeQueries outside 2-5 warns, not errors', () => {
  const d = good(); d.entries[0].representativeQueries = ['only-one'];
  const { errors, warnings } = validate(d);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some(w => /representativeQueries/.test(w)));
});
```

**Step 3 — Run, expect FAIL:** `node --test tools/ards/test/validate.test.mjs` → "Cannot find module '../lib/validate.mjs'".

**Step 4 — Implement `validate.mjs`:**
```js
import { SPEC_VERSION, URN_RE } from './constants.mjs';

export function validate(doc) {
  const errors = [];
  const warnings = [];
  if (doc.specVersion !== SPEC_VERSION) errors.push(`specVersion must be "${SPEC_VERSION}"`);
  if (!Array.isArray(doc.entries) || doc.entries.length < 1) errors.push('entries must be a non-empty array');
  if (doc.host) {
    if (!doc.host.displayName) errors.push('host.displayName required when host is present');
    if (doc.host.trustManifest && !doc.host.trustManifest.identity) errors.push('host.trustManifest.identity required when trustManifest is present');
  }
  for (const [i, e] of (doc.entries || []).entries()) {
    if (!e.identifier) errors.push(`entries[${i}].identifier required`);
    else if (!URN_RE.test(e.identifier)) errors.push(`entries[${i}].identifier must match urn:ai: pattern`);
    if (!e.displayName) errors.push(`entries[${i}].displayName required`);
    if (!e.type) errors.push(`entries[${i}].type required`);
    if ((e.url != null) === (e.data != null)) errors.push(`entries[${i}] must contain exactly one of url or data`);
    if (e.trustManifest && !e.trustManifest.identity) errors.push(`entries[${i}].trustManifest.identity required`);
    if (e.representativeQueries && (e.representativeQueries.length < 2 || e.representativeQueries.length > 5)) {
      warnings.push(`entries[${i}].representativeQueries SHOULD contain 2-5 items`);
    }
  }
  return { errors, warnings };
}
```

**Step 5 — Run, expect PASS:** `node --test tools/ards/test/validate.test.mjs`.

**Step 6 — Commit:**
```bash
git add tools/ards/lib/constants.mjs tools/ards/lib/validate.mjs tools/ards/test/validate.test.mjs
git commit -m "feat(ards): constants + capability-manifest validator"
```

---

### Task 2: catalog + DID builders

**Files:**
- Create: `tools/ards/build-catalog.mjs`, `tools/ards/build-did.mjs`
- Test: `tools/ards/test/build.test.mjs`

**Step 1 — Failing test:**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from '../build-catalog.mjs';
import { buildDid } from '../build-did.mjs';
import { validate } from '../lib/validate.mjs';

const card = {
  title: 'Vreeman Site Search', version: '1.0.0',
  description: 'MCP server for vreeman.com — search tools and Stoic library.',
  tools: [{ name: 'search_content' }],
};

test('catalog from server-card is valid', () => {
  const c = buildCatalog(card, '2026-06-19T00:00:00.000Z');
  assert.equal(c.specVersion, '1.0');
  assert.equal(c.host.displayName, 'Vreeman.com');
  assert.equal(c.host.identifier, 'did:web:vreeman.com');
  assert.equal(c.entries.length, 1);
  assert.equal(c.entries[0].type, 'application/mcp-server+json');
  assert.equal(c.entries[0].url, 'https://vreeman.com/.well-known/mcp/server-card.json');
  assert.deepEqual(c.entries[0].capabilities, ['search_content']);
  assert.equal(c.entries[0].updatedAt, '2026-06-19T00:00:00.000Z');
  assert.deepEqual(validate(c).errors, []);
});
test('did doc resolves identity + advertises the catalog', () => {
  const d = buildDid();
  assert.equal(d.id, 'did:web:vreeman.com');
  assert.deepEqual(d.alsoKnownAs, ['https://vreeman.com/']);
  assert.equal(d.service[0].type, 'AICatalog');
  assert.equal(d.service[0].serviceEndpoint, 'https://vreeman.com/.well-known/ai-catalog.json');
});
```

**Step 2 — Run, expect FAIL.**

**Step 3 — Implement `build-catalog.mjs`:**
```js
import { publisher } from '../entitymap/data/publisher.mjs';
import { SPEC_VERSION, DID, MCP_MEDIA_TYPE } from './lib/constants.mjs';

export function buildCatalog(serverCard, now) {
  return {
    specVersion: SPEC_VERSION,
    host: {
      displayName: publisher.name,
      identifier: DID,
      documentationUrl: publisher.url,
      trustManifest: { identity: DID, identityType: 'did' },
    },
    entries: [
      {
        identifier: 'urn:ai:vreeman.com:mcp:site-search',
        displayName: serverCard.title,
        type: MCP_MEDIA_TYPE,
        url: 'https://vreeman.com/.well-known/mcp/server-card.json',
        description: serverCard.description,
        capabilities: (serverCard.tools || []).map(t => t.name),
        representativeQueries: [
          'seneca letters on the fear of death',
          'epictetus dichotomy of control',
          'GA4 UTM campaign URL builder',
        ],
        version: serverCard.version,
        updatedAt: now,
      },
    ],
  };
}
```

**Step 4 — Implement `build-did.mjs`:**
```js
import { DID } from './lib/constants.mjs';

export function buildDid() {
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: DID,
    alsoKnownAs: ['https://vreeman.com/'],
    service: [
      { id: `${DID}#catalog`, type: 'AICatalog', serviceEndpoint: 'https://vreeman.com/.well-known/ai-catalog.json' },
    ],
  };
}
```

**Step 5 — Run, expect PASS.**

**Step 6 — Commit:**
```bash
git add tools/ards/build-catalog.mjs tools/ards/build-did.mjs tools/ards/test/build.test.mjs
git commit -m "feat(ards): catalog + did.json builders from server-card"
```

---

### Task 3: ARDS build orchestrator (writes the artifacts)

**Files:**
- Create: `tools/ards/build.mjs`

**Step 1 — Implement `build.mjs`:**
```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from './build-catalog.mjs';
import { buildDid } from './build-did.mjs';
import { validate } from './lib/validate.mjs';
import { CATALOG_PATH, DID_PATH } from './lib/constants.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function main() {
  const card = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.well-known/mcp/server-card.json'), 'utf8'));
  const catalog = buildCatalog(card, new Date().toISOString());
  const { errors, warnings } = validate(catalog);
  for (const w of warnings) console.warn(`WARN  ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`ERROR ${e}`);
    console.error(`\n${errors.length} error(s) — not writing.`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(REPO_ROOT, CATALOG_PATH), JSON.stringify(catalog, null, 2) + '\n');
  fs.writeFileSync(path.join(REPO_ROOT, DID_PATH), JSON.stringify(buildDid(), null, 2) + '\n');
  console.log(`OK  ${catalog.entries.length} entry → ${CATALOG_PATH} + ${DID_PATH}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

**Step 2 — Run it:** `node tools/ards/build.mjs`
Expected: `OK  1 entry → .well-known/ai-catalog.json + .well-known/did.json`

**Step 3 — Inspect outputs:** `cat .well-known/ai-catalog.json .well-known/did.json` — confirm shape matches the design §3.

**Step 4 — Commit:**
```bash
git add tools/ards/build.mjs .well-known/ai-catalog.json .well-known/did.json
git commit -m "feat(ards): build orchestrator + generated ai-catalog.json + did.json"
```

---

### Task 4: ARDS discovery & serving wiring

**Files:**
- Modify: `robots.txt` (after the existing `EntityMap:` line)
- Modify: `_headers` (after the EntityMap header rules)
- Modify: `index.html` (in `<head>`, before `</head>` at line ~588)

**Step 1 — `robots.txt`:** add after the `EntityMap:` line:
```
Agentmap: https://vreeman.com/.well-known/ai-catalog.json
```

**Step 2 — `_headers`:** append:
```
# ARDS capability catalog — needs the right Content-Type + CORS so agents can fetch cross-origin
/.well-known/ai-catalog.json
    Content-Type: application/ai-catalog+json
    Access-Control-Allow-Origin: *
    Cache-Control: public, max-age=3600
/.well-known/did.json
    Content-Type: application/did+json
    Access-Control-Allow-Origin: *
    Cache-Control: public, max-age=3600
```

**Step 3 — `index.html`:** add a link rel beside the other `<link rel=…>` tags (near line 286, with webmention/micropub):
```html
    <link rel="ai-catalog" href="https://vreeman.com/.well-known/ai-catalog.json">
```

**Step 4 — Verify:** `grep -n "Agentmap" robots.txt && grep -n "ai-catalog" _headers index.html`
Expected: one hit each in robots.txt and index.html, the Content-Type rule in _headers.

**Step 5 — Commit:**
```bash
git add robots.txt _headers index.html
git commit -m "feat(ards): advertise catalog via robots Agentmap, _headers MIME/CORS, HTML link rel"
```

---

### Task 5: ARDS README

**Files:** Create `tools/ards/README.md`

**Step 1 — Write it** (mirror `tools/entitymap/README.md` tone):
```markdown
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
```

**Step 2 — Commit:**
```bash
git add tools/ards/README.md
git commit -m "docs(ards): build tooling README"
```

---

## PHASE 2 — OKF bundle

### Task 6: frontmatter parse + serialize

**Files:**
- Create: `tools/okf/lib/frontmatter.mjs`
- Test: `tools/okf/test/frontmatter.test.mjs`

**Step 1 — Failing test:**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, serializeFrontmatter } from '../lib/frontmatter.mjs';

test('round-trips a simple block', () => {
  const md = serializeFrontmatter({ type: 'Concept', title: 'Stoicism' });
  assert.ok(md.startsWith('---\n'));
  const fm = parseFrontmatter(md + '\n# body');
  assert.equal(fm.type, 'Concept');
  assert.equal(fm.title, 'Stoicism');
});
test('quotes values containing colons', () => {
  const md = serializeFrontmatter({ type: 'Work', title: 'Letter 1: On Saving Time' });
  assert.ok(md.includes('"Letter 1: On Saving Time"'));
});
test('returns null when no frontmatter', () => {
  assert.equal(parseFrontmatter('# just a heading'), null);
});
test('omits empty/absent fields', () => {
  const md = serializeFrontmatter({ type: 'Person', title: 'Seneca', resource: undefined });
  assert.ok(!md.includes('resource'));
});
```

**Step 2 — Run, expect FAIL.**

**Step 3 — Implement `frontmatter.mjs`:**
```js
function needsQuote(s) {
  return /[:#\[\]{}",&*?|<>=!%@`]/.test(s) || /^\s|\s$/.test(s) || s === '';
}
function yamlScalar(v) {
  const s = String(v);
  return needsQuote(s) ? JSON.stringify(s) : s;
}

// Serialize a flat object to a YAML frontmatter block. `tags` is rendered as a flow list.
export function serializeFrontmatter(obj) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.map(yamlScalar).join(', ')}]`);
    else lines.push(`${k}: ${yamlScalar(v)}`);
  }
  lines.push('---');
  return lines.join('\n');
}

// Minimal parser: enough to validate generated files (key: scalar pairs).
export function parseFrontmatter(md) {
  if (!md.startsWith('---\n')) return null;
  const end = md.indexOf('\n---', 4);
  if (end === -1) return null;
  const obj = {};
  for (const line of md.slice(4, end + 1).split('\n')) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (m) obj[m[1]] = m[2];
  }
  return obj;
}
```

**Step 4 — Run, expect PASS. Step 5 — Commit:**
```bash
git add tools/okf/lib/frontmatter.mjs tools/okf/test/frontmatter.test.mjs
git commit -m "feat(okf): YAML frontmatter serialize + parse helpers"
```

---

### Task 7: entity-id → bundle path + relative links

**Files:**
- Create: `tools/okf/lib/paths.mjs`
- Test: `tools/okf/test/paths.test.mjs`

**Step 1 — Failing test:**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { entityPath, relLink } from '../lib/paths.mjs';

test('maps every id prefix', () => {
  assert.equal(entityPath('concept-stoicism'), 'concepts/stoicism.md');
  assert.equal(entityPath('person-seneca'), 'persons/seneca.md');
  assert.equal(entityPath('work-moral-letters'), 'works/moral-letters.md');
  assert.equal(entityPath('seneca-letter-12'), 'seneca/letter-12.md');
});
test('throws on unknown prefix', () => {
  assert.throws(() => entityPath('widget-x'));
});
test('relative link crosses directories', () => {
  assert.equal(relLink('concepts/stoicism.md', 'works/meditations.md'), '../works/meditations.md');
  assert.equal(relLink('concepts/stoicism.md', 'concepts/logos.md'), './logos.md');
});
```

**Step 2 — Run, expect FAIL.**

**Step 3 — Implement `paths.mjs`:**
```js
import path from 'node:path';

export function entityPath(entityId) {
  if (entityId.startsWith('concept-')) return `concepts/${entityId.slice(8)}.md`;
  if (entityId.startsWith('person-')) return `persons/${entityId.slice(7)}.md`;
  if (entityId.startsWith('work-')) return `works/${entityId.slice(5)}.md`;
  const m = entityId.match(/^seneca-letter-(\d+)$/);
  if (m) return `seneca/letter-${m[1]}.md`;
  throw new Error(`Unknown entityId prefix: ${entityId}`);
}

export function relLink(fromPath, toPath) {
  let rel = path.posix.relative(path.posix.dirname(fromPath), toPath);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}
```

**Step 4 — Run, expect PASS. Step 5 — Commit:**
```bash
git add tools/okf/lib/paths.mjs tools/okf/test/paths.test.mjs
git commit -m "feat(okf): entity-id → bundle path + relative link helpers"
```

---

### Task 8: entity → markdown concept document

**Files:**
- Create: `tools/okf/lib/entity-to-markdown.mjs`
- Test: `tools/okf/test/entity-to-markdown.test.mjs`

**Step 1 — Failing test:**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { entityToMarkdown } from '../lib/entity-to-markdown.mjs';
import { entityPath } from '../lib/paths.mjs';
import { WORK_TYPE } from '../../entitymap/data/vocabulary.mjs';

const idToPath = entityPath;
const now = '2026-06-19T00:00:00.000Z';

const concept = {
  entityId: 'concept-stoicism', '@type': 'Concept', name: 'Stoicism',
  description: 'The Hellenistic school founded by Zeno.',
  sameAs: ['https://www.wikidata.org/wiki/Q48235'],
  relations: [
    { predicate: 'INSTANCE_OF', targetId: 'concept-philosophy', targetName: 'Philosophy' },
    { predicate: 'DESCRIBED_BY', targetId: 'work-meditations', targetName: 'Meditations' },
  ],
  hasChunks: [{ chunkId: 'c1', text: 'The Stoic school takes its name from the stoa.', sourceUrl: 'https://vreeman.com/meditations/', pageTitle: 'Meditations', publisher: 'Vreeman.com', contentType: 'definition', relevanceScore: 0.95 }],
};

test('frontmatter has required non-empty type and maps Concept', () => {
  const md = entityToMarkdown(concept, now, idToPath);
  assert.match(md, /^---\ntype: Concept\n/);
  assert.match(md, /title: Stoicism/);
  assert.match(md, /resource: https:\/\/www\.wikidata\.org\/wiki\/Q48235/);
});
test('relations become linked prose with predicate verbs', () => {
  const md = entityToMarkdown(concept, now, idToPath);
  assert.match(md, /## Related/);
  assert.match(md, /An instance of \[Philosophy\]\(\.\/philosophy\.md\)\./);
  assert.match(md, /Described by \[Meditations\]\(\.\.\/works\/meditations\.md\)\./);
});
test('chunks become Examples blockquote + Citations', () => {
  const md = entityToMarkdown(concept, now, idToPath);
  assert.match(md, /## Examples\n\n> The Stoic school takes its name from the stoa\. \[1\]/);
  assert.match(md, /## Citations\n\n\[1\] \[Meditations\]\(https:\/\/vreeman\.com\/meditations\/\)/);
});
test('custom Work @type maps to bare "Work"', () => {
  const md = entityToMarkdown({ ...concept, '@type': WORK_TYPE, entityId: 'work-meditations', relations: [], sameAs: [] }, now, idToPath);
  assert.match(md, /^---\ntype: Work\n/);
});
```

**Step 2 — Run, expect FAIL.**

**Step 3 — Implement `entity-to-markdown.mjs`:**
```js
import { WORK_TYPE } from '../../entitymap/data/vocabulary.mjs';
import { serializeFrontmatter } from './frontmatter.mjs';
import { relLink } from './paths.mjs';

const PREDICATE_VERB = {
  INSTANCE_OF: 'An instance of',
  PART_OF: 'Part of',
  INCLUDES: 'Includes',
  AUTHORED_BY: 'Written by',
  TRANSLATED_BY: 'Translated by',
  DESCRIBED_BY: 'Described by',
  RELATES_TO: 'Related to',
  PRECEDES: 'Precedes',
};

export function okfType(entity) {
  return entity['@type'] === WORK_TYPE ? 'Work' : entity['@type'];
}

function resourceFor(entity) {
  const firstSource = entity.hasChunks?.[0]?.sourceUrl;
  const wikidata = entity.sameAs?.[0];
  // Works/letters: the canonical vreeman.com page. Concepts/persons: Wikidata if present, else the page.
  return okfType(entity) === 'Work' ? (firstSource || wikidata) : (wikidata || firstSource);
}

export function entityToMarkdown(entity, now, idToPath) {
  const fromPath = idToPath(entity.entityId);
  const type = okfType(entity);
  const fm = serializeFrontmatter({
    type,
    title: entity.name,
    description: entity.description,
    resource: resourceFor(entity),
    tags: ['stoicism', type.toLowerCase()],
    timestamp: now,
    sameAs: entity.sameAs?.[0],
  });

  const lines = [`# ${entity.name}`, '', entity.description, ''];

  if (entity.relations?.length) {
    lines.push('## Related', '');
    for (const r of entity.relations) {
      const verb = PREDICATE_VERB[r.predicate] || r.predicate;
      if (r.targetId) lines.push(`- ${verb} [${r.targetName}](${relLink(fromPath, idToPath(r.targetId))}).`);
      else lines.push(`- ${verb} **${r.targetName}**.`);
    }
    lines.push('');
  }

  const chunks = entity.hasChunks || [];
  if (chunks.length) {
    lines.push('## Examples', '');
    chunks.forEach((c, i) => lines.push(`> ${c.text} [${i + 1}]`, ''));
    lines.push('## Citations', '');
    chunks.forEach((c, i) => lines.push(`[${i + 1}] [${c.pageTitle}](${c.sourceUrl})`));
    lines.push('');
  }

  return `${fm}\n${lines.join('\n')}`;
}
```

**Step 4 — Run, expect PASS. Step 5 — Commit:**
```bash
git add tools/okf/lib/entity-to-markdown.mjs tools/okf/test/entity-to-markdown.test.mjs
git commit -m "feat(okf): entity → markdown concept (frontmatter, related, examples, citations)"
```

---

### Task 9: index.md + log.md renderers

**Files:**
- Create: `tools/okf/lib/render-index.mjs`, `tools/okf/lib/render-log.mjs`
- Test: `tools/okf/test/render.test.mjs`

**Step 1 — Failing test:**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDirIndex, renderRootIndex } from '../lib/render-index.mjs';
import { renderLog } from '../lib/render-log.mjs';

test('dir index lists entries, no frontmatter', () => {
  const md = renderDirIndex('Concepts', [{ file: 'stoicism.md', title: 'Stoicism', description: 'The school.' }]);
  assert.ok(!md.startsWith('---'));
  assert.match(md, /# Concepts/);
  assert.match(md, /\* \[Stoicism\]\(stoicism\.md\) - The school\./);
});
test('root index carries only okf_version and links sections', () => {
  const md = renderRootIndex([{ dir: 'concepts', title: 'Concepts', description: 'Core doctrines.' }]);
  assert.match(md, /^---\nokf_version: "0\.1"\n---/);
  assert.match(md, /\* \[Concepts\]\(concepts\/\) - Core doctrines\./);
});
test('log has an ISO date heading', () => {
  const md = renderLog('2026-06-19', 102);
  assert.match(md, /## 2026-06-19/);
  assert.match(md, /\*\*Initialization\*\*/);
  assert.match(md, /102/);
});
```

**Step 2 — Run, expect FAIL.**

**Step 3 — Implement `render-index.mjs`:**
```js
export function renderDirIndex(title, entries) {
  const lines = [`# ${title}`, ''];
  for (const e of entries) lines.push(`* [${e.title}](${e.file})${e.description ? ` - ${e.description}` : ''}`);
  return `${lines.join('\n')}\n`;
}

export function renderRootIndex(sections) {
  const lines = [
    '---', 'okf_version: "0.1"', '---',
    '# Vreeman.com — Stoicism (OKF bundle)', '',
    "An OKF v0.1 bundle of this site's Stoic library, for AI agents and humans. Generated from the same data as the site's EntityMap.", '',
  ];
  for (const s of sections) lines.push(`* [${s.title}](${s.dir}/) - ${s.description}`);
  return `${lines.join('\n')}\n`;
}
```

**Step 4 — Implement `render-log.mjs`:**
```js
export function renderLog(date, entityCount) {
  return [
    '# Log', '',
    `## ${date}`, '',
    `* **Initialization**: Created the OKF bundle with ${entityCount} concepts, generated from the site's EntityMap data.`,
    '',
  ].join('\n');
}
```

**Step 5 — Run, expect PASS. Step 6 — Commit:**
```bash
git add tools/okf/lib/render-index.mjs tools/okf/lib/render-log.mjs tools/okf/test/render.test.mjs
git commit -m "feat(okf): index.md (dir + root) and log.md renderers"
```

---

### Task 10: OKF bundle validator (conformance §9)

**Files:**
- Create: `tools/okf/lib/validate.mjs`
- Test: `tools/okf/test/validate.test.mjs`

**Step 1 — Failing test:**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBundle } from '../lib/validate.mjs';

const ok = () => new Map([
  ['index.md', '---\nokf_version: "0.1"\n---\n# Bundle\n'],
  ['log.md', '# Log\n\n## 2026-06-19\n\n* **Initialization**: x\n'],
  ['concepts/index.md', '# Concepts\n\n* [X](x.md)\n'],
  ['concepts/stoicism.md', '---\ntype: Concept\ntitle: Stoicism\n---\n# Stoicism\n'],
]);

test('conformant bundle passes', () => {
  assert.deepEqual(validateBundle(ok()).errors, []);
});
test('concept without type fails', () => {
  const f = ok(); f.set('concepts/x.md', '---\ntitle: No Type\n---\n# x\n');
  assert.ok(validateBundle(f).errors.some(e => /type/.test(e)));
});
test('concept without frontmatter fails', () => {
  const f = ok(); f.set('concepts/x.md', '# just a heading\n');
  assert.ok(validateBundle(f).errors.some(e => /frontmatter/.test(e)));
});
test('sub-dir index.md with frontmatter fails', () => {
  const f = ok(); f.set('concepts/index.md', '---\ntype: Concept\n---\n# Concepts\n');
  assert.ok(validateBundle(f).errors.some(e => /index\.md must not contain frontmatter/.test(e)));
});
test('root index.md with non-okf_version key fails', () => {
  const f = ok(); f.set('index.md', '---\nokf_version: "0.1"\ntype: X\n---\n# Bundle\n');
  assert.ok(validateBundle(f).errors.some(e => /only carry okf_version/.test(e)));
});
```

**Step 2 — Run, expect FAIL.**

**Step 3 — Implement `validate.mjs`:**
```js
import { parseFrontmatter } from './frontmatter.mjs';

// files: Map<relativePath, content>. Encodes OKF v0.1 §9 conformance.
export function validateBundle(files) {
  const errors = [];
  for (const [rel, content] of files) {
    const base = rel.split('/').pop();
    if (base === 'index.md') {
      const fm = parseFrontmatter(content);
      if (rel === 'index.md') {
        if (fm && Object.keys(fm).some(k => k !== 'okf_version')) {
          errors.push(`${rel}: bundle-root index.md may only carry okf_version`);
        }
      } else if (fm) {
        errors.push(`${rel}: index.md must not contain frontmatter`);
      }
    } else if (base === 'log.md') {
      if (!/^##\s+\d{4}-\d{2}-\d{2}/m.test(content)) errors.push(`${rel}: log.md needs an ISO ## YYYY-MM-DD heading`);
    } else {
      const fm = parseFrontmatter(content);
      if (!fm) errors.push(`${rel}: missing or unparseable YAML frontmatter`);
      else if (!fm.type || !fm.type.replace(/"/g, '').trim()) errors.push(`${rel}: frontmatter "type" is required and must be non-empty`);
    }
  }
  return { errors };
}
```

**Step 4 — Run, expect PASS. Step 5 — Commit:**
```bash
git add tools/okf/lib/validate.mjs tools/okf/test/validate.test.mjs
git commit -m "feat(okf): bundle conformance validator (OKF v0.1 §9)"
```

---

### Task 11: OKF build orchestrator (writes the /okf/ tree)

**Files:**
- Create: `tools/okf/build.mjs`
- Test: `tools/okf/test/build.test.mjs`

**Step 1 — Failing test** (tests the in-memory `buildBundle` export, not disk):
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBundle } from '../build.mjs';
import { validateBundle } from '../lib/validate.mjs';

const files = buildBundle('2026-06-19T00:00:00.000Z');

test('bundle is conformant and complete', () => {
  assert.deepEqual(validateBundle(files).errors, []);
  assert.ok(files.has('index.md'));
  assert.ok(files.has('log.md'));
  assert.ok(files.has('concepts/index.md'));
  assert.ok(files.has('concepts/stoicism.md'));
  assert.ok(files.has('seneca/index.md'));
});
test('one file per entity (~100+)', () => {
  const concepts = [...files.keys()].filter(k => !k.endsWith('index.md') && k !== 'log.md');
  assert.ok(concepts.length >= 100, `expected >=100 concept files, got ${concepts.length}`);
});
```

**Step 2 — Run, expect FAIL.**

**Step 3 — Implement `build.mjs`:**
```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { concepts } from '../entitymap/data/concepts.mjs';
import { persons } from '../entitymap/data/persons.mjs';
import { works } from '../entitymap/data/works.mjs';
import { bootstrapLetters } from '../entitymap/lib/bootstrap-letters.mjs';
import { entityPath } from './lib/paths.mjs';
import { entityToMarkdown } from './lib/entity-to-markdown.mjs';
import { renderDirIndex, renderRootIndex } from './lib/render-index.mjs';
import { renderLog } from './lib/render-log.mjs';
import { validateBundle } from './lib/validate.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OKF_DIR = path.join(REPO_ROOT, 'okf');

const SECTIONS = [
  { dir: 'concepts', title: 'Concepts', description: 'Core Stoic concepts and doctrines.' },
  { dir: 'persons', title: 'Persons', description: 'Philosophers, translators, and key figures.' },
  { dir: 'works', title: 'Works', description: 'Primary works, essays, and collections.' },
  { dir: 'seneca', title: "Seneca's Letters", description: "Seneca's Moral Letters to Lucilius." },
];

function letterNum(id) {
  const m = id.match(/^seneca-letter-(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export function buildBundle(now = new Date().toISOString()) {
  const entities = [
    ...concepts, ...persons, ...works,
    ...bootstrapLetters(path.join(REPO_ROOT, 'seneca')),
  ];
  const files = new Map();

  // one concept doc per entity
  for (const e of entities) files.set(entityPath(e.entityId), entityToMarkdown(e, now, entityPath));

  // per-section index.md
  for (const s of SECTIONS) {
    let items = entities.filter(e => entityPath(e.entityId).startsWith(`${s.dir}/`));
    if (s.dir === 'seneca') items = items.slice().sort((a, b) => letterNum(a.entityId) - letterNum(b.entityId));
    const entriesList = items.map(e => ({
      file: entityPath(e.entityId).split('/').pop(),
      title: e.name,
      description: e.description,
    }));
    files.set(`${s.dir}/index.md`, renderDirIndex(s.title, entriesList));
  }

  files.set('index.md', renderRootIndex(SECTIONS));
  files.set('log.md', renderLog(now.slice(0, 10), entities.length));
  return files;
}

function main() {
  const files = buildBundle();
  const { errors } = validateBundle(files);
  if (errors.length) {
    for (const e of errors) console.error(`ERROR ${e}`);
    console.error(`\n${errors.length} error(s) — not writing.`);
    process.exit(1);
  }
  fs.rmSync(OKF_DIR, { recursive: true, force: true });
  for (const [rel, content] of files) {
    const abs = path.join(OKF_DIR, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content.endsWith('\n') ? content : `${content}\n`);
  }
  console.log(`OK  ${files.size} files → okf/`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

**Step 4 — Run unit test, expect PASS:** `node --test tools/okf/test/build.test.mjs`

**Step 5 — Run the generator:** `node tools/okf/build.mjs`
Expected: `OK  <N> files → okf/` (N ≈ 108: 103 concepts + 4 section indexes + root index + log).

**Step 6 — Spot-check output:**
```bash
ls okf && head -20 okf/index.md && head -25 okf/concepts/stoicism.md && head -10 okf/seneca/index.md
```
Confirm: root index has `okf_version: "0.1"`; `concepts/stoicism.md` has `type: Concept` + Related/Examples/Citations; seneca index is letter-ordered.

**Step 7 — Commit:**
```bash
git add tools/okf/build.mjs tools/okf/test/build.test.mjs okf/
git commit -m "feat(okf): build orchestrator + generated /okf/ bundle (~102 concepts)"
```

---

### Task 12: OKF discovery & serving wiring

**Files:**
- Modify: `llms.txt` (add a section)
- Modify: `sitemap.xml` (add the `/okf/` index near the `entitymap.html` entry)
- Modify: `_headers` (markdown Content-Type + CORS for `/okf/*`)

**Step 1 — `llms.txt`:** add after the `## Stoicism` block (or at end, before any trailing section):
```
## Open Knowledge Format
- [OKF knowledge bundle (Stoic library, for AI agents)](https://vreeman.com/okf/)
```

**Step 2 — `sitemap.xml`:** add beside the existing entitymap entry:
```xml
  <url>
    <loc>https://vreeman.com/okf/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
```

**Step 3 — `_headers`:** append:
```
# OKF bundle — serve markdown as text/markdown so agents read it inline; allow cross-origin fetch
/okf/*
    Content-Type: text/markdown; charset=utf-8
    Access-Control-Allow-Origin: *
```

**Step 4 — Verify:** `grep -n "okf" llms.txt sitemap.xml _headers`
Expected: one llms.txt section, one sitemap `<loc>`, one `_headers` rule.

**Step 5 — Commit:**
```bash
git add llms.txt sitemap.xml _headers
git commit -m "feat(okf): advertise bundle via llms.txt, sitemap, and _headers markdown MIME"
```

---

### Task 13: OKF README

**Files:** Create `tools/okf/README.md`

**Step 1 — Write it:**
```markdown
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
```

**Step 2 — Commit:**
```bash
git add tools/okf/README.md
git commit -m "docs(okf): build tooling README"
```

---

## PHASE 3 — Validation & finalize

### Task 14: Full test + validation sweep

**Step 1 — Run all tests (incl. EntityMap, to confirm no regressions from shared imports):**
```bash
node --test tools/entitymap/test/*.test.mjs tools/ards/test/*.test.mjs tools/okf/test/*.test.mjs
```
Expected: all pass (EntityMap's ~41 + new ARDS + OKF tests).

**Step 2 — Re-run both generators idempotently (confirm no diff on a clean rebuild except timestamps):**
```bash
node tools/ards/build.mjs && node tools/okf/build.mjs && git status --short
```
Expected: only `updatedAt`/`timestamp` churn if anything (those are build-stamped); structure stable.

**Step 3 — Validate the catalog JSON parses + is well-formed:**
```bash
node -e "JSON.parse(require('fs').readFileSync('.well-known/ai-catalog.json','utf8')); JSON.parse(require('fs').readFileSync('.well-known/did.json','utf8')); console.log('JSON OK')"
```

**Step 4 — Local serve smoke check** (Cloudflare Pages serves `/.well-known/` + `.md`; confirm files resolve):
```bash
python3 -m http.server 8765 >/dev/null 2>&1 &
SRV=$!; sleep 1
curl -sI http://localhost:8765/.well-known/ai-catalog.json | head -1
curl -s  http://localhost:8765/okf/index.md | head -3
curl -s  http://localhost:8765/okf/concepts/stoicism.md | head -3
kill $SRV
```
Expected: 200 for the catalog; the markdown files print their headings. (Note: the local server won't apply `_headers` Content-Type overrides — those are verified post-deploy in Step 5.)

**Step 5 — (Post-deploy, manual) Verify live MIME + CORS** once merged & deployed:
```bash
curl -sI https://vreeman.com/.well-known/ai-catalog.json | grep -i 'content-type\|access-control'
```
Expected: `content-type: application/ai-catalog+json` and `access-control-allow-origin: *`. If Cloudflare ignores the `.well-known` Content-Type override, note it as a watch-item (the live suganthan.com example serves plain `application/json` and still works).

---

### Task 15: Record the re-validation obligation in memory

**Step 1 — Write a memory file** `/Users/simonvreeman/.claude/projects/-Users-simonvreeman-Documents-GitHub-simonvreeman-github-io/memory/okf-ards-project.md` capturing:
- Both specs are **drafts** (ARDS v0.9 w/ stale schema `$id`; OKF v0.1, not an official Google product), adopted as showcases like EntityMap.
- Artifacts: `tools/ards/` → `.well-known/ai-catalog.json` + `did.json`; `tools/okf/` → `/okf/` bundle (generated from EntityMap data).
- Watch-items: `MCP_MEDIA_TYPE` (spec vs `-card+json`), `host.displayName = "Vreeman.com"`, Cloudflare `.well-known` Content-Type override.
- **Obligation:** re-validate both when they leave draft / against any official validator; rebuild with `node tools/ards/build.mjs` and `node tools/okf/build.mjs`.
- Link `[[entitymap-project]]` and `[[agent-readiness-project]]`.

**Step 2 — Add the index line to `memory/MEMORY.md`:**
```
- [OKF + ARDS project](okf-ards-project.md) — OKF bundle + ARDS catalog showcases; generators, watch-items, post-draft re-validation
```

**Step 3 — (No git commit — memory is outside the repo.)**

---

### Task 16: Finish the branch

Use `superpowers:finishing-a-development-branch` to choose merge / PR / cleanup. Suggested final commit message summary already covered by per-task commits; the design + implementation docs are committed under `docs/plans/`.

---

## Notes for the executor
- **DRY:** OKF must import entities from `tools/entitymap/data` — never copy entity data.
- **YAGNI:** one ARDS entry (the real MCP); do not invent A2A/OpenAPI entries.
- **Validate-then-write:** both generators must `process.exit(1)` on any validation error before writing (the EntityMap contract).
- If `persons.mjs`/`works.mjs` entities lack `hasChunks` or `relations`, the renderer already guards with `?.` — Examples/Related sections are simply omitted.
- Re-run `node --test tools/entitymap/test/*.test.mjs` after Phase 2 to confirm the shared-import refactor didn't disturb EntityMap.
