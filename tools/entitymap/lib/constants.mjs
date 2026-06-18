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

export const INVERSE_PAIRS = [
  ['PART_OF', 'INCLUDES'],
  ['ENABLES', 'PREVENTS'],
  ['IMPROVES', 'DEGRADES'],
  ['OFFERS', 'PRODUCED_BY'],
];

export const PREDICATE_SOURCE_TYPES = {
  MEASURES: ['Metric'],
  AFFILIATED_WITH: ['Person'],
  COVERS: ['Concept', 'ProprietaryTerm', 'Taxonomy'],
  OFFERS: ['Organization'],
};
export const PREDICATE_TARGET_TYPES = {
  OFFERS: ['SoftwareProduct', 'Service', 'Platform', 'PhysicalProduct'],
};

export const CHUNK_CONTENT_TYPES = new Set(['definition', 'evidence', 'example', 'statistic', 'procedure']);
export const VERIFICATION_STATUSES = new Set(['self-declared', 'generator-draft', 'third-party-verified']);
export const CONFIDENCE_VALUES = new Set(['declared', 'inferred']);
export const MAX_CHUNK_CHARS = 600;
export const MAX_CHUNKS_PER_ENTITY = 5;
