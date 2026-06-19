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
