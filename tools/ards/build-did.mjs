import { DID, SITE_ORIGIN } from './lib/constants.mjs';

export function buildDid() {
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: DID,
    alsoKnownAs: [`${SITE_ORIGIN}/`],
    service: [
      { id: `${DID}#catalog`, type: 'AICatalog', serviceEndpoint: `${SITE_ORIGIN}/.well-known/ai-catalog.json` },
    ],
  };
}
