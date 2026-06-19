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
