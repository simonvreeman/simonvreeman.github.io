export const NAMESPACE = 'https://vreeman.com/entitymap/vocab/v1';
// Custom @type for literary works (EntityMap has no Book/CreativeWork type).
export const WORK_TYPE = `${NAMESPACE}#Work`;
// One custom predicate: work -> translator (no standard equivalent).
export const CUSTOM_PREDICATES = ['TRANSLATED_BY'];
export const vocabulary = { predicates: CUSTOM_PREDICATES, namespace: NAMESPACE };
