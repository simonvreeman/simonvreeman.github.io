# EntityMap v1.0 (Stoicism) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish a spec-conformant EntityMap v1.0 knowledge graph for vreeman.com's Stoicism library, generated deterministically from a single data source.

**Architecture:** A Node ESM generator (`tools/entitymap/build.mjs`) loads hand-authored entity data + bootstraps Seneca's letter pages, validates the assembled document against every v1.0 conformance rule, and emits `entitymap.json` + `entitymap.html` at the repo root. Discovery is minimal (`robots.txt` + `sitemap.xml`). A static page at `/entitymap/vocab/v1/` documents the one custom type and predicate.

**Tech Stack:** Node.js (ESM `.mjs`), `node --test` (no third-party deps — mirrors the existing `functions/mcp.js` test approach). Static hosting on Cloudflare Pages.

**Design doc:** `docs/plans/2026-06-18-entitymap-design.md` (read it first — it holds the verified spec facts).

---

## Layout note (refines design §5)

Build tooling lives under `tools/entitymap/` (NOT `entitymap/`) so source files don't pollute the public `/entitymap/` URL namespace. Public/served paths are only: `/entitymap.json`, `/entitymap.html` (repo root) and `/entitymap/vocab/v1/index.html`.

```
tools/entitymap/
  data/   publisher.mjs  vocabulary.mjs  concepts.mjs  persons.mjs  works.mjs
  lib/    constants.mjs  validate.mjs  bootstrap-letters.mjs  render-html.mjs  text.mjs
  build.mjs
  test/   validate.test.mjs  bootstrap-letters.test.mjs  build.test.mjs
  README.md
entitymap/vocab/v1/index.html      (public namespace doc)
entitymap.json  entitymap.html     (generated, repo root)
robots.txt  sitemap.xml            (edited)
```

**Commit discipline:** one commit per task (TDD: test → fail → implement → pass → commit). Work on the `entitymap` branch (already created).

---

## Phase 0 — Constants & static data

### Task 1: Spec constants

**Files:**
- Create: `tools/entitymap/lib/constants.mjs`
- Test: `tools/entitymap/test/constants.test.mjs`

**Step 1: Write the failing test**

```js
// tools/entitymap/test/constants.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE_TYPES, STANDARD_PREDICATES, TIER3, INVERSE_PAIRS } from '../lib/constants.mjs';

test('16 core types incl. Guide', () => {
  assert.equal(CORE_TYPES.size, 16);
  assert.ok(CORE_TYPES.has('Concept'));
  assert.ok(CORE_TYPES.has('Guide'));
});

test('24 standard predicates; Tier 3 has 6', () => {
  assert.equal(STANDARD_PREDICATES.size, 24);
  assert.equal(TIER3.size, 6);
  assert.ok(TIER3.has('IMPROVES'));
});

test('inverse pairs include PART_OF/INCLUDES', () => {
  assert.ok(INVERSE_PAIRS.some(([a, b]) => a === 'PART_OF' && b === 'INCLUDES'));
});
```

**Step 2: Run to verify it fails**

Run: `node --test tools/entitymap/test/constants.test.mjs`
Expected: FAIL (Cannot find module `../lib/constants.mjs`).

**Step 3: Implement**

```js
// tools/entitymap/lib/constants.mjs
export const SCHEMA_URI = 'https://entitymap.org/spec/v1.0';
export const VERSION = '1.0';

export const CORE_TYPES = new Set([
  'Concept', 'ProprietaryTerm', 'Methodology', 'Metric', 'Taxonomy',
  'Person', 'Organization', 'SoftwareProduct', 'PhysicalProduct', 'Service', 'Platform', 'Place',
  'Event', 'Standard', 'Regulation', 'Guide',
]);

export const TIER1 = new Set([
  'INSTANCE_OF', 'PART_OF', 'INCLUDES', 'DEPENDS_ON', 'REQUIRES', 'MEASURES',
  'PRODUCED_BY', 'REGULATED_BY', 'AUTHORED_BY', 'AFFILIATED_WITH', 'COVERS',
]);
export const TIER2 = new Set([
  'RELATES_TO', 'PRECEDES', 'ENABLES', 'PREVENTS', 'CONFLICTS_WITH', 'DESCRIBED_BY', 'OFFERS',
]);
export const TIER3 = new Set([
  'IMPROVES', 'DEGRADES', 'LEADS_TO', 'SUITED_FOR', 'TARGETS', 'ACHIEVES',
]);
export const STANDARD_PREDICATES = new Set([...TIER1, ...TIER2, ...TIER3]);

// "Never declare both members of a pair between the same two entities."
export const INVERSE_PAIRS = [
  ['PART_OF', 'INCLUDES'],
  ['ENABLES', 'PREVENTS'],
  ['IMPROVES', 'DEGRADES'],
  ['OFFERS', 'PRODUCED_BY'],
];

// Source-entity @type constraints (validator errors otherwise).
export const PREDICATE_SOURCE_TYPES = {
  MEASURES: ['Metric'],
  AFFILIATED_WITH: ['Person'],
  COVERS: ['Concept', 'ProprietaryTerm', 'Taxonomy'],
  OFFERS: ['Organization'],
};
// Target-entity @type constraints (only checked for internal targets).
export const PREDICATE_TARGET_TYPES = {
  OFFERS: ['SoftwareProduct', 'Service', 'Platform', 'PhysicalProduct'],
};

export const CHUNK_CONTENT_TYPES = new Set(['definition', 'evidence', 'example', 'statistic', 'procedure']);
export const VERIFICATION_STATUSES = new Set(['self-declared', 'generator-draft', 'third-party-verified']);
export const CONFIDENCE_VALUES = new Set(['declared', 'inferred']);
export const MAX_CHUNK_CHARS = 600;
export const MAX_CHUNKS_PER_ENTITY = 5;
```

**Step 4: Run to verify it passes**

Run: `node --test tools/entitymap/test/constants.test.mjs` → Expected: PASS (3 tests).

**Step 5: Commit**

```bash
git add tools/entitymap/lib/constants.mjs tools/entitymap/test/constants.test.mjs
git commit -m "feat(entitymap): spec constants (types, predicates, limits)"
```

---

### Task 2: Publisher + vocabulary data

**Files:**
- Create: `tools/entitymap/data/publisher.mjs`, `tools/entitymap/data/vocabulary.mjs`

No test (pure constants — exercised by the validator tests). 

**Step 1: Implement**

```js
// tools/entitymap/data/publisher.mjs
// NOTE: spec says publisher.name should be a brand, not a domain. "Vreeman.com" is the
// site's brand name (schema.json WebSite.name). If the live validator rejects it after the
// 2026-07-01 launch, change to "Simon Vreeman" and rebuild — it is the only place to edit.
export const publisher = { name: 'Vreeman.com', url: 'https://vreeman.com/' };
```

```js
// tools/entitymap/data/vocabulary.mjs
export const NAMESPACE = 'https://vreeman.com/entitymap/vocab/v1';
// Custom @type for literary works (EntityMap has no Book/CreativeWork type).
// Represented as a fully-namespaced URI so it is unambiguously "a namespaced custom type".
export const WORK_TYPE = `${NAMESPACE}#Work`;
// One custom predicate: work -> translator (no standard equivalent; AUTHORED_BY is for authors).
export const CUSTOM_PREDICATES = ['TRANSLATED_BY'];
// Goes in the root document's `vocabulary` block.
export const vocabulary = { predicates: CUSTOM_PREDICATES, namespace: NAMESPACE };
```

**Step 2: Commit**

```bash
git add tools/entitymap/data/publisher.mjs tools/entitymap/data/vocabulary.mjs
git commit -m "feat(entitymap): publisher + custom vocabulary (Work type, TRANSLATED_BY)"
```

---

## Phase 1 — Validator (the conformance core, TDD)

`validate(doc)` returns `{ errors: string[], warnings: string[] }`. `build.mjs` aborts if `errors` is non-empty. Build the validator incrementally; each task adds checks with a failing test first.

### Task 3: Validator skeleton + root checks

**Files:**
- Create: `tools/entitymap/lib/validate.mjs`
- Test: `tools/entitymap/test/validate.test.mjs`

**Step 1: Write the failing test**

```js
// tools/entitymap/test/validate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../lib/validate.mjs';
import { WORK_TYPE, vocabulary } from '../data/vocabulary.mjs';

// Minimal conformant document reused across tests.
function validDoc(overrides = {}) {
  return {
    version: '1.0',
    schema: 'https://entitymap.org/spec/v1.0',
    publisher: { name: 'Vreeman.com', url: 'https://vreeman.com/' },
    generated: '2026-06-18T00:00:00Z',
    profile: 'core',
    verificationStatus: 'self-declared',
    vocabulary,
    entities: [
      {
        entityId: 'concept-stoicism',
        '@type': 'Concept',
        name: 'Stoicism',
        description: 'A Hellenistic philosophy.',
        hasChunks: [{
          chunkId: 'c1', text: 'Stoicism is a school of philosophy.',
          sourceUrl: 'https://vreeman.com/meditations/', pageTitle: 'Meditations',
          publisher: 'Vreeman.com', contentType: 'definition',
        }],
      },
    ],
    ...overrides,
  };
}

test('valid minimal doc has no errors', () => {
  assert.deepEqual(validate(validDoc()).errors, []);
});

test('missing root field errors', () => {
  const d = validDoc(); delete d.publisher;
  assert.ok(validate(d).errors.some((e) => /publisher/.test(e)));
});

test('wrong version errors', () => {
  assert.ok(validate(validDoc({ version: '0.9' })).errors.some((e) => /version/.test(e)));
});

export { validDoc };
```

**Step 2: Run to verify it fails** — `node --test tools/entitymap/test/validate.test.mjs` → FAIL (module missing).

**Step 3: Implement (root checks only for now)**

```js
// tools/entitymap/lib/validate.mjs
import {
  VERSION, SCHEMA_URI, CORE_TYPES, STANDARD_PREDICATES, TIER3,
  INVERSE_PAIRS, PREDICATE_SOURCE_TYPES, PREDICATE_TARGET_TYPES,
  CHUNK_CONTENT_TYPES, VERIFICATION_STATUSES, CONFIDENCE_VALUES,
  MAX_CHUNK_CHARS, MAX_CHUNKS_PER_ENTITY,
} from './constants.mjs';

export function validate(doc) {
  const errors = [];
  const warnings = [];
  const customTypes = new Set();
  const customPredicates = new Set((doc.vocabulary?.predicates) || []);
  const namespace = doc.vocabulary?.namespace;
  if (namespace) customTypes.add(`${namespace}#Work`); // matches data/vocabulary.mjs convention

  // --- Root ---
  if (doc.version !== VERSION) errors.push(`root.version must be "${VERSION}"`);
  if (doc.schema !== SCHEMA_URI) errors.push(`root.schema must be "${SCHEMA_URI}"`);
  if (!doc.publisher || typeof doc.publisher.name !== 'string' || typeof doc.publisher.url !== 'string') {
    errors.push('root.publisher must be an object with name and url');
  } else if (/^[a-z0-9-]+\.[a-z]{2,}$/i.test(doc.publisher.name)) {
    warnings.push(`root.publisher.name "${doc.publisher.name}" looks like a domain; spec wants a brand name`);
  }
  if (!doc.generated || Number.isNaN(Date.parse(doc.generated))) errors.push('root.generated must be an ISO 8601 timestamp');
  if (doc.verificationStatus && !VERIFICATION_STATUSES.has(doc.verificationStatus)) {
    errors.push(`root.verificationStatus invalid: ${doc.verificationStatus}`);
  }
  if (!Array.isArray(doc.entities) || doc.entities.length < 1) {
    errors.push('root.entities must be a non-empty array');
    return { errors, warnings };
  }

  const pubName = doc.publisher?.name;
  const ids = new Set();
  const chunkIds = new Set();
  const byId = new Map(doc.entities.map((e) => [e.entityId, e]));

  for (const e of doc.entities) {
    validateEntity(e, { errors, warnings, ids, chunkIds, pubName, customTypes, customPredicates, byId });
  }

  validateInversePairs(doc.entities, errors);
  return { errors, warnings };
}

// placeholders filled in subsequent tasks:
function validateEntity() {}
function validateInversePairs() {}
```

**Step 4: Run** — only the first test (`valid minimal doc`) and `wrong version`/`missing publisher` matter now. They should PASS. The richer entity tests added later will fail until implemented — that's expected; keep going.

**Step 5: Commit**

```bash
git add tools/entitymap/lib/validate.mjs tools/entitymap/test/validate.test.mjs
git commit -m "feat(entitymap): validator root-object checks"
```

---

### Task 4: Entity-level checks

**Files:** Modify `tools/entitymap/lib/validate.mjs`; add tests to `validate.test.mjs`.

**Step 1: Add failing tests**

```js
test('entity missing description errors', () => {
  const d = validDoc(); delete d.entities[0].description;
  assert.ok(validate(d).errors.some((e) => /description/.test(e)));
});
test('unknown @type errors', () => {
  const d = validDoc(); d.entities[0]['@type'] = 'Widget';
  assert.ok(validate(d).errors.some((e) => /@type/.test(e)));
});
test('custom namespaced Work @type is allowed', () => {
  const d = validDoc(); d.entities[0]['@type'] = WORK_TYPE;
  assert.deepEqual(validate(d).errors, []);
});
test('duplicate entityId errors', () => {
  const d = validDoc(); d.entities.push({ ...d.entities[0] });
  assert.ok(validate(d).errors.some((e) => /duplicate/i.test(e)));
});
test('deprecated entity without replacedBy errors', () => {
  const d = validDoc(); d.entities[0].status = 'deprecated';
  assert.ok(validate(d).errors.some((e) => /replacedBy/.test(e)));
});
```

**Step 2: Run → these FAIL.**

**Step 3: Implement `validateEntity` (replace the placeholder)**

```js
function validateEntity(e, ctx) {
  const { errors, ids, customTypes } = ctx;
  const id = e.entityId;
  if (!id || typeof id !== 'string') { errors.push('entity.entityId required'); return; }
  if (ids.has(id)) errors.push(`duplicate entityId: ${id}`);
  ids.add(id);

  const type = e['@type'];
  const typeOk = CORE_TYPES.has(type) || customTypes.has(type) ||
    (ctx.byId && false); // custom types must be namespaced URIs already in customTypes
  if (!typeOk) errors.push(`entity ${id}: invalid @type "${type}" (not a core type or declared custom type)`);

  if (!e.name) errors.push(`entity ${id}: name required`);
  if (!e.description) errors.push(`entity ${id}: description required`);

  if (e.status === 'deprecated' || e.status === 'merged') {
    if (!e.replacedBy) errors.push(`entity ${id}: replacedBy required when status is ${e.status}`);
  }

  if (!Array.isArray(e.hasChunks) || e.hasChunks.length < 1) {
    errors.push(`entity ${id}: hasChunks must have 1-${MAX_CHUNKS_PER_ENTITY} chunks`);
  } else if (e.hasChunks.length > MAX_CHUNKS_PER_ENTITY) {
    errors.push(`entity ${id}: hasChunks exceeds ${MAX_CHUNKS_PER_ENTITY}`);
  } else {
    for (const c of e.hasChunks) validateChunk(c, id, ctx);
  }

  if (Array.isArray(e.relations)) {
    for (const r of e.relations) validateRelation(r, e, ctx);
  }
}

function validateChunk() {}   // Task 5
function validateRelation() {} // Task 6
```

**Step 4: Run → entity tests PASS** (chunk/relation tests still pending).

**Step 5: Commit** — `feat(entitymap): validator entity checks`.

---

### Task 5: Chunk checks (600-char, publisher match, contentType)

**Step 1: Add failing tests**

```js
test('chunk over 600 chars errors', () => {
  const d = validDoc(); d.entities[0].hasChunks[0].text = 'x'.repeat(601);
  assert.ok(validate(d).errors.some((e) => /600/.test(e)));
});
test('chunk publisher mismatch errors', () => {
  const d = validDoc(); d.entities[0].hasChunks[0].publisher = 'vreeman.com';
  assert.ok(validate(d).errors.some((e) => /publisher.*match/i.test(e)));
});
test('bad contentType errors', () => {
  const d = validDoc(); d.entities[0].hasChunks[0].contentType = 'nonsense';
  assert.ok(validate(d).errors.some((e) => /contentType/.test(e)));
});
test('duplicate chunkId errors', () => {
  const d = validDoc();
  d.entities[0].hasChunks.push({ ...d.entities[0].hasChunks[0] });
  assert.ok(validate(d).errors.some((e) => /chunkId/.test(e)));
});
```

**Step 2: Run → FAIL.**

**Step 3: Implement `validateChunk`**

```js
function validateChunk(c, entId, ctx) {
  const { errors, chunkIds, pubName } = ctx;
  if (!c.chunkId) errors.push(`entity ${entId}: chunk missing chunkId`);
  else if (chunkIds.has(c.chunkId)) errors.push(`duplicate chunkId: ${c.chunkId}`);
  else chunkIds.add(c.chunkId);

  if (!c.text || typeof c.text !== 'string') errors.push(`chunk ${c.chunkId}: text required`);
  else if ([...c.text].length > MAX_CHUNK_CHARS) errors.push(`chunk ${c.chunkId}: text exceeds ${MAX_CHUNK_CHARS} characters`);

  if (!c.sourceUrl || !/^https?:\/\//.test(c.sourceUrl)) errors.push(`chunk ${c.chunkId}: sourceUrl must be an absolute URL`);
  if (!c.pageTitle) errors.push(`chunk ${c.chunkId}: pageTitle required`);
  if (c.publisher !== pubName) errors.push(`chunk ${c.chunkId}: publisher "${c.publisher}" must exactly match root publisher.name "${pubName}"`);
  if (c.contentType && !CHUNK_CONTENT_TYPES.has(c.contentType)) errors.push(`chunk ${c.chunkId}: invalid contentType "${c.contentType}"`);
  if (c.relevanceScore != null && (c.relevanceScore < 0 || c.relevanceScore > 1)) errors.push(`chunk ${c.chunkId}: relevanceScore must be 0.0-1.0`);
}
```

> Use `[...c.text].length` (code-point count) so multi-byte Greek (e.g. `Τὰ εἰς ἑαυτόν`) is counted sanely. If the live validator counts UTF-16 units instead, revisit post-launch.

**Step 4: Run → chunk tests PASS.**

**Step 5: Commit** — `feat(entitymap): validator chunk checks (600-char, publisher match)`.

---

### Task 6: Relation checks (predicate whitelist, Tier-3 confidence, type constraints)

**Step 1: Add failing tests**

```js
test('unknown predicate errors', () => {
  const d = validDoc();
  d.entities[0].relations = [{ predicate: 'FOO_BAR', targetName: 'X' }];
  assert.ok(validate(d).errors.some((e) => /predicate/.test(e)));
});
test('custom TRANSLATED_BY predicate allowed', () => {
  const d = validDoc();
  d.entities[0].relations = [{ predicate: 'TRANSLATED_BY', targetName: 'Gregory Hays' }];
  assert.deepEqual(validate(d).errors, []);
});
test('Tier-3 predicate without confidence errors', () => {
  const d = validDoc();
  d.entities[0].relations = [{ predicate: 'IMPROVES', targetName: 'Resilience' }];
  assert.ok(validate(d).errors.some((e) => /confidence/.test(e)));
});
test('COVERS from a non-Concept source errors', () => {
  const d = validDoc();
  d.entities[0]['@type'] = 'Person';
  d.entities[0].relations = [{ predicate: 'COVERS', targetName: 'X' }];
  assert.ok(validate(d).errors.some((e) => /COVERS/.test(e)));
});
test('targetId must resolve to an entity', () => {
  const d = validDoc();
  d.entities[0].relations = [{ predicate: 'RELATES_TO', targetId: 'ghost', targetName: 'Ghost' }];
  assert.ok(validate(d).errors.some((e) => /targetId/.test(e)));
});
```

**Step 2: Run → FAIL.**

**Step 3: Implement `validateRelation`**

```js
function validateRelation(r, srcEntity, ctx) {
  const { errors, customPredicates, byId } = ctx;
  const p = r.predicate;
  if (!p) { errors.push(`entity ${srcEntity.entityId}: relation missing predicate`); return; }
  const known = STANDARD_PREDICATES.has(p) || customPredicates.has(p);
  if (!known) errors.push(`entity ${srcEntity.entityId}: unknown predicate "${p}"`);
  if (!r.targetName) errors.push(`entity ${srcEntity.entityId}: relation ${p} missing targetName`);

  if (TIER3.has(p) && !CONFIDENCE_VALUES.has(r.confidence)) {
    errors.push(`entity ${srcEntity.entityId}: Tier-3 predicate ${p} requires confidence (declared|inferred)`);
  }

  // Source @type constraint
  const srcReq = PREDICATE_SOURCE_TYPES[p];
  if (srcReq && !srcReq.includes(srcEntity['@type'])) {
    errors.push(`entity ${srcEntity.entityId}: ${p} requires source @type in [${srcReq.join(', ')}]`);
  }

  // Internal target resolution + target @type constraint
  if (r.targetId) {
    const target = byId.get(r.targetId);
    if (!target) { errors.push(`entity ${srcEntity.entityId}: relation ${p} targetId "${r.targetId}" does not resolve`); }
    else {
      const tgtReq = PREDICATE_TARGET_TYPES[p];
      if (tgtReq && !tgtReq.includes(target['@type'])) {
        errors.push(`entity ${srcEntity.entityId}: ${p} requires target @type in [${tgtReq.join(', ')}]`);
      }
    }
  }
}
```

**Step 4: Run → relation tests PASS.**

**Step 5: Commit** — `feat(entitymap): validator relation checks`.

---

### Task 7: Inverse-pair guard

**Step 1: Add failing test**

```js
test('declaring both PART_OF and INCLUDES between same pair errors', () => {
  const d = validDoc();
  d.entities.push({
    entityId: 'work-discourses', '@type': WORK_TYPE, name: 'Discourses', description: 'Lectures.',
    relations: [{ predicate: 'INCLUDES', targetId: 'concept-stoicism', targetName: 'Stoicism' }],
    hasChunks: [{ chunkId: 'c2', text: 'Discourses.', sourceUrl: 'https://vreeman.com/discourses/', pageTitle: 'Discourses', publisher: 'Vreeman.com' }],
  });
  d.entities[0].relations = [{ predicate: 'PART_OF', targetId: 'work-discourses', targetName: 'Discourses' }];
  assert.ok(validate(d).errors.some((e) => /inverse/i.test(e)));
});
```

**Step 2: Run → FAIL.**

**Step 3: Implement `validateInversePairs` (replace placeholder)**

```js
function validateInversePairs(entities, errors) {
  // Collect predicates per unordered entity-pair (only relations with internal targetId).
  const byPair = new Map(); // key "a|b" (sorted) -> Set(predicates)
  for (const e of entities) {
    for (const r of e.relations || []) {
      if (!r.targetId) continue;
      const [a, b] = [e.entityId, r.targetId].sort();
      const key = `${a}|${b}`;
      if (!byPair.has(key)) byPair.set(key, new Set());
      byPair.get(key).add(r.predicate);
    }
  }
  for (const [key, preds] of byPair) {
    for (const [p, q] of INVERSE_PAIRS) {
      if (preds.has(p) && preds.has(q)) {
        errors.push(`inverse-pair violation on ${key}: both ${p} and ${q} declared`);
      }
    }
  }
}
```

**Step 4: Run → all `validate.test.mjs` tests PASS** (run the whole file: `node --test tools/entitymap/test/validate.test.mjs`).

**Step 5: Commit** — `feat(entitymap): validator inverse-pair guard`.

---

## Phase 2 — Named entity data (~36 entities)

The validator now guards correctness; author the curated data against it. **Process for each entity:** (1) open its page; (2) copy a *verbatim* sentence or two as the chunk `text` (≤600 chars); (3) write a 1–3 sentence `description`; (4) add `sameAs` only from the design doc's confirmed Wikidata IDs; (5) add relations using the predicate guidance in design §6.

> Entity-id convention: `concept-<slug>`, `person-<slug>`, `work-<slug>`, `seneca-letter-<n>`.
> Chunk-id convention: `<entityId>-c<n>`.
> All `sourceUrl`s are **extensionless** (e.g. `https://vreeman.com/seneca/letter-1`) to match `sitemap.xml`.

### Task 8: `concepts.mjs` (10 Concepts)

**Files:** Create `tools/entitymap/data/concepts.mjs`.

**Worked example (use as the template for all 10):**

```js
// tools/entitymap/data/concepts.mjs
export const concepts = [
  {
    entityId: 'concept-stoicism',
    '@type': 'Concept',
    name: 'Stoicism',
    description: 'The Hellenistic school of philosophy founded in Athens by Zeno of Citium, treated across this library as both a theoretical system (logic, physics, ethics) and a practical discipline of virtue, fate, and self-control.',
    sameAs: 'https://www.wikidata.org/wiki/Q48235',
    relations: [
      { predicate: 'INSTANCE_OF', targetId: 'concept-philosophy', targetName: 'Philosophy' },
      { predicate: 'DESCRIBED_BY', targetId: 'work-meditations', targetName: 'Meditations' },
    ],
    hasChunks: [
      {
        chunkId: 'concept-stoicism-c1',
        text: '<VERBATIM ≤600-char quote pulled from https://vreeman.com/meditations/ that defines Stoicism>',
        sourceUrl: 'https://vreeman.com/meditations/',
        pageTitle: 'Meditations by Marcus Aurelius. Translation by Gregory Hays.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
  // ... 9 more: concept-philosophy, concept-logos, concept-dichotomy-of-control,
  // concept-three-disciplines, concept-four-cardinal-virtues, concept-amor-fati,
  // concept-memento-mori, concept-providence, concept-stockdale-triad
  // (see design §6 for sameAs IDs, sources, and relations)
];
```

**Steps:** Author all 10 → add a temporary scratch test that imports `concepts` and runs `validate` on a doc wrapping them (or defer validation to the Task 13 integration test) → commit `feat(entitymap): 10 Stoic concept entities`.

### Task 9: `persons.mjs` (12 Persons)

Same template, `'@type': 'Person'`. Authors get `RELATES_TO` to Stoicism; lineage uses `PRECEDES` (Zeno→Cleanthes→Chrysippus; Musonius→Epictetus); translators are targets of `TRANSLATED_BY` from works (declared on the work side, not here). Wikidata IDs in design §6. Commit `feat(entitymap): 12 Stoic person entities`.

### Task 10: `works.mjs` (~14 primary Works)

`'@type': WORK_TYPE` (import from `../data/vocabulary.mjs`). Each work: `AUTHORED_BY` its author, `TRANSLATED_BY` its translator(s), `INSTANCE_OF` Stoicism; collections (Moral Letters, Stockdale collection) use `INCLUDES` toward members; Enchiridion/Fragments use `PART_OF` toward the Discourses corpus (one direction only — the corpus must NOT also declare `INCLUDES` back, per the inverse-pair guard). Commit `feat(entitymap): primary Stoic work entities`.

---

## Phase 3 — Bootstrap the Seneca letters

### Task 11: `bootstrap-letters.mjs` + HTML text helper

**Files:**
- Create: `tools/entitymap/lib/text.mjs` (shared HTML→text helper)
- Create: `tools/entitymap/lib/bootstrap-letters.mjs`
- Test: `tools/entitymap/test/bootstrap-letters.test.mjs`

**Step 1: Write failing tests**

```js
// tools/entitymap/test/bootstrap-letters.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTags, firstSentencesWithin } from '../lib/text.mjs';
import { bootstrapLetters } from '../lib/bootstrap-letters.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test('stripTags removes markup and decodes entities', () => {
  assert.equal(stripTags('<p>Greet&nbsp;&amp; go</p>'), 'Greet & go');
});

test('firstSentencesWithin never exceeds the limit and breaks on a sentence', () => {
  const s = 'One sentence here. A second much longer sentence that would blow the budget entirely.';
  const out = firstSentencesWithin(s, 30);
  assert.ok(out.length <= 30);
  assert.ok(s.startsWith(out)); // verbatim prefix
});

test('bootstrapLetters reads real letter files and yields conformant entities', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const letters = bootstrapLetters(path.join(repoRoot, 'seneca'));
  assert.ok(letters.length >= 60, `expected ~68 letters, got ${letters.length}`);
  for (const e of letters) {
    assert.match(e.entityId, /^seneca-letter-\d+$/);
    assert.equal(e['@type'].endsWith('#Work'), true);
    assert.equal(e.hasChunks.length, 1);
    assert.ok([...e.hasChunks[0].text].length <= 600);
    assert.equal(e.hasChunks[0].publisher, 'Vreeman.com');
  }
  // the malformed seneca/letter-.html must be skipped
  assert.equal(letters.some((e) => e.entityId === 'seneca-letter-'), false);
});
```

**Step 2: Run → FAIL.**

**Step 3: Implement**

```js
// tools/entitymap/lib/text.mjs
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&mdash;': '—', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”' };
export function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}
// Longest verbatim prefix that ends on a sentence boundary and fits within `limit`.
export function firstSentencesWithin(text, limit = 600) {
  if ([...text].length <= limit) return text;
  const slice = text.slice(0, limit);
  const lastStop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (lastStop > 0) return slice.slice(0, lastStop + 1).trim();
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim();
}
```

```js
// tools/entitymap/lib/bootstrap-letters.mjs
import fs from 'node:fs';
import path from 'node:path';
import { stripTags, firstSentencesWithin } from './text.mjs';
import { WORK_TYPE } from '../data/vocabulary.mjs';
import { publisher } from '../data/publisher.mjs';

const LETTER_RE = /^letter-(\d+)\.html$/; // excludes the malformed "letter-.html"

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]) : '';
}
function firstParagraph(html) {
  const body = html.replace(/<header[\s\S]*?<\/header>/i, '');
  for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = stripTags(m[1]);
    if (t.length > 80) return t; // first substantive paragraph
  }
  return '';
}

export function bootstrapLetters(senecaDir) {
  const out = [];
  for (const file of fs.readdirSync(senecaDir).sort()) {
    const match = file.match(LETTER_RE);
    if (!match) continue;
    const n = Number(match[1]);
    const html = fs.readFileSync(path.join(senecaDir, file), 'utf8');
    const title = extractTitle(html) || `Letter ${n}`;
    const para = firstParagraph(html);
    if (!para) continue; // skip empty/odd pages rather than emit an invalid chunk
    const text = firstSentencesWithin(para, 600);
    out.push({
      entityId: `seneca-letter-${n}`,
      '@type': WORK_TYPE,
      name: title,
      description: `Letter ${n} of Seneca's Moral Letters to Lucilius: “${title.replace(/^Letter\s+\d+:\s*/i, '')}”.`,
      relations: [
        { predicate: 'PART_OF', targetId: 'work-moral-letters', targetName: 'Moral Letters to Lucilius' },
        { predicate: 'AUTHORED_BY', targetId: 'person-seneca', targetName: 'Seneca the Younger' },
      ],
      hasChunks: [{
        chunkId: `seneca-letter-${n}-c1`,
        text,
        sourceUrl: `https://vreeman.com/seneca/letter-${n}`,
        pageTitle: title,
        publisher: publisher.name,
        contentType: 'evidence',
        relevanceScore: 0.7,
      }],
    });
  }
  return out;
}
```

> The `description` keeps ≤3 sentences and never repeats the chunk verbatim. Confirm `work-moral-letters` and `person-seneca` ids exist in `works.mjs`/`persons.mjs` so the validator's targetId resolution passes.

**Step 4: Run → bootstrap tests PASS** (`node --test tools/entitymap/test/bootstrap-letters.test.mjs`).

**Step 5: Commit** — `feat(entitymap): bootstrap Seneca letter entities from page HTML`.

---

## Phase 4 — HTML renderer

### Task 12: `render-html.mjs`

**Pre-step (REQUIRED):** Fetch the spec's "conforming `entitymap.html` MUST" list — `https://raw.githubusercontent.com/entitymap/entitymap/main/spec/v1.0/index.md` (the HTML section we did not fully capture has ~6 MUST items). Encode each one. Known requirement: include **plain-text attribution** (publisher name as text, not only in tags) because LLM pipelines strip HTML.

**Files:** Create `tools/entitymap/lib/render-html.mjs`; Test `tools/entitymap/test/render-html.test.mjs`.

**Step 1: Failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHtml } from '../lib/render-html.mjs';

const doc = {
  version: '1.0', schema: 'https://entitymap.org/spec/v1.0',
  publisher: { name: 'Vreeman.com', url: 'https://vreeman.com/' },
  generated: '2026-06-18T00:00:00Z',
  entities: [{ entityId: 'concept-stoicism', '@type': 'Concept', name: 'Stoicism', description: 'A philosophy.',
    hasChunks: [{ chunkId: 'c1', text: 'Stoicism is a school.', sourceUrl: 'https://vreeman.com/meditations/', pageTitle: 'Meditations', publisher: 'Vreeman.com' }] }],
};

test('renders valid standalone HTML with plain-text attribution', () => {
  const html = renderHtml(doc);
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /Vreeman\.com/);                 // attribution present as text
  assert.match(html, /Stoicism/);
  assert.match(html, /https:\/\/vreeman\.com\/meditations\//);
  assert.doesNotMatch(html, /<script/i);              // no scripts; static view
});
```

**Step 2: Run → FAIL.**

**Step 3: Implement** a function that escapes text and emits a semantic document: `<h1>` with publisher + generated date, a plain-text attribution line, then one `<section>` per entity (name, type, description, `sameAs` link, relations `<ul>`, chunk `<blockquote>` with a `<cite><a href=sourceUrl>` link). Escape all interpolated strings. Keep it dependency-free.

**Step 4: Run → PASS. Step 5: Commit** — `feat(entitymap): entitymap.html renderer`.

---

## Phase 5 — Build orchestrator

### Task 13: `build.mjs` + integration test

**Files:** Create `tools/entitymap/build.mjs`; Test `tools/entitymap/test/build.test.mjs`.

**Step 1: Failing integration test**

```js
// tools/entitymap/test/build.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDoc } from '../build.mjs';
import { validate } from '../lib/validate.mjs';

test('assembled document validates with zero errors', () => {
  const doc = buildDoc();
  const { errors } = validate(doc);
  assert.deepEqual(errors, [], errors.join('\n'));
});
test('document has the expected shape and scale', () => {
  const doc = buildDoc();
  assert.equal(doc.version, '1.0');
  assert.ok(doc.entities.length >= 90, `expected ~100+ entities, got ${doc.entities.length}`);
  assert.ok(doc.entities.length < 200, 'still under the sharding threshold');
  for (const e of doc.entities) for (const c of e.hasChunks) {
    assert.ok([...c.text].length <= 600);
    assert.equal(c.publisher, 'Vreeman.com');
  }
});
```

**Step 2: Run → FAIL.**

**Step 3: Implement**

```js
// tools/entitymap/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION, SCHEMA_URI } from './lib/constants.mjs';
import { publisher } from './data/publisher.mjs';
import { vocabulary } from './data/vocabulary.mjs';
import { concepts } from './data/concepts.mjs';
import { persons } from './data/persons.mjs';
import { works } from './data/works.mjs';
import { bootstrapLetters } from './lib/bootstrap-letters.mjs';
import { validate } from './lib/validate.mjs';
import { renderHtml } from './lib/render-html.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function buildDoc(now = new Date().toISOString()) {
  const entities = [
    ...concepts,
    ...persons,
    ...works,
    ...bootstrapLetters(path.join(REPO_ROOT, 'seneca')),
  ];
  return {
    version: VERSION,
    schema: SCHEMA_URI,
    publisher,
    generated: now,
    profile: 'core',
    verificationStatus: 'self-declared',
    vocabulary,
    entities,
  };
}

function main() {
  const doc = buildDoc();
  const { errors, warnings } = validate(doc);
  for (const w of warnings) console.warn(`WARN  ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`ERROR ${e}`);
    console.error(`\n${errors.length} error(s) — not writing.`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(REPO_ROOT, 'entitymap.json'), JSON.stringify(doc, null, 2) + '\n');
  fs.writeFileSync(path.join(REPO_ROOT, 'entitymap.html'), renderHtml(doc));
  console.log(`OK  ${doc.entities.length} entities → entitymap.json + entitymap.html`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

**Step 4: Run** — `node --test tools/entitymap/test/build.test.mjs`, then run the generator for real: `node tools/entitymap/build.mjs`. Expected: `OK  N entities → …`. Inspect `entitymap.json` (pretty JSON) and open `entitymap.html`.

**Step 5: Commit** — `feat(entitymap): build orchestrator + generated entitymap.json/html`. (Commit the generated files too.)

---

## Phase 6 — Discovery, namespace page, serving

### Task 14: robots.txt + sitemap.xml

**Files:** Modify `robots.txt`, `sitemap.xml`.

- `robots.txt`: add after the `Sitemap:` line:
  ```
  EntityMap: https://vreeman.com/entitymap.json
  Disallow: /tools/
  ```
- `sitemap.xml`: add before `</urlset>`:
  ```xml
  <url><loc>https://vreeman.com/entitymap.html</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
  ```

Commit — `feat(entitymap): advertise EntityMap in robots.txt + sitemap.xml`.

### Task 15: namespace documentation page

**Files:** Create `entitymap/vocab/v1/index.html`.

A small static page (reuse the site's existing `<head>`/CSS conventions) documenting the namespace `https://vreeman.com/entitymap/vocab/v1`: the custom `@type` `Work` (definition + why EntityMap's core types don't cover literary works) and the custom predicate `TRANSLATED_BY` (subject = a Work, object = a Person translator; inverse of authorship-style attribution). This URL **must resolve** — the spec requires custom predicates be documented at the declared namespace URI. Commit — `feat(entitymap): publish custom vocab namespace page`.

### Task 16: serving header + README

**Files:** Modify `_headers` (if needed); Create `tools/entitymap/README.md`.

- Verify Cloudflare Pages serves `/entitymap.json` as `application/json` (check after deploy; add a `_headers` block only if it serves as `text/plain`). Optionally add `Cache-Control: public, max-age=3600`.
- `README.md`: "Run `node tools/entitymap/build.mjs` before committing whenever entity data or a Stoic page changes. `entitymap.html` is generated — never edit it by hand. To change the publisher identity, edit `data/publisher.mjs` only."

Commit — `docs(entitymap): serving notes + regeneration README`.

---

## Phase 7 — Validation & launch checkpoints

### Task 17: Live validation

1. `node --test tools/entitymap/` — full suite green.
2. `node tools/entitymap/build.mjs` — clean build, no warnings except the known `publisher.name` domain warning (expected/accepted).
3. Paste `entitymap.json` into `https://entitymap.org/validate` (or push the branch, deploy a preview, and use "Fetch from URL"). Resolve any errors it reports — especially **(a)** whether `Vreeman.com` is accepted as `publisher.name` and **(b)** whether the fully-namespaced custom `@type` URI is accepted. If `publisher.name` is rejected, switch `data/publisher.mjs` to `Simon Vreeman` and rebuild.
4. **Post-2026-07-01 re-validation:** after the spec freezes/launches, re-run the validator and diff the spec for any changed required fields; patch `constants.mjs`/data and rebuild.

### Task 18: Finish the branch

Run the `superpowers:finishing-a-development-branch` skill — open a PR (or merge) so `master` deploys the new files. Confirm the live URLs resolve: `/entitymap.json`, `/entitymap.html`, `/entitymap/vocab/v1/`, and the `robots.txt` line.

---

## Testing summary

- `node --test tools/entitymap/` runs everything.
- Validator unit tests prove each rule rejects bad input AND accepts good input.
- `bootstrap-letters.test.mjs` runs against the real `seneca/` pages.
- `build.test.mjs` is the integration gate: the full assembled document must validate with **zero** errors and stay under 200 entities.

## Out of scope (YAGNI)

- Sharding (only needed >200 entities; revisit when folding in the marketing/tools pages).
- A GitHub Action to auto-rebuild (manual `build.mjs` + README note suffices for now).
- Editing the 150 Stoic HTML pages for `<link rel="entitymap">`/footer links (discovery is `robots.txt` + `sitemap.xml` per the chosen minimal scope).
- Fixing the pre-existing `on-the-tranquillity-of-mind.html` JSON-LD author bug (noted in design §4; separate change).
