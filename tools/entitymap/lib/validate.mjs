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
  if (namespace) customTypes.add(`${namespace}#Work`);

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
  const ctx = { errors, warnings, ids, chunkIds, pubName, customTypes, customPredicates, byId };

  for (const e of doc.entities) validateEntity(e, ctx);
  validateInversePairs(doc.entities, errors);
  return { errors, warnings };
}

function validateEntity(e, ctx) {
  const { errors, ids, customTypes } = ctx;
  const id = e.entityId;
  if (!id || typeof id !== 'string') { errors.push('entity.entityId required'); return; }
  if (ids.has(id)) errors.push(`duplicate entityId: ${id}`);
  ids.add(id);

  const type = e['@type'];
  const typeOk = CORE_TYPES.has(type) || customTypes.has(type);
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

  const srcReq = PREDICATE_SOURCE_TYPES[p];
  if (srcReq && !srcReq.includes(srcEntity['@type'])) {
    errors.push(`entity ${srcEntity.entityId}: ${p} requires source @type in [${srcReq.join(', ')}]`);
  }

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

function validateInversePairs(entities, errors) {
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
