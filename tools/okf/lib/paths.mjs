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
