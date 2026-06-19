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
