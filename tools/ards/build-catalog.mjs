import { publisher } from '../entitymap/data/publisher.mjs';
import { SPEC_VERSION, DID, MCP_MEDIA_TYPE, OKF_MEDIA_TYPE, SITE_ORIGIN, ENTRY_URN, OKF_ENTRY_URN } from './lib/constants.mjs';

export function buildCatalog(serverCard, now) {
  return {
    specVersion: SPEC_VERSION,
    host: {
      displayName: publisher.name,
      identifier: DID,
      documentationUrl: publisher.url,
      trustManifest: { identity: DID, identityType: 'did' },
    },
    // Each entry carries both `type` (ARD layer) and `mediaType` (the base ai-catalog spec) with
    // identical values — the two specs disagree on the field name, so we emit both until they align.
    entries: [
      {
        identifier: ENTRY_URN,
        displayName: serverCard.title,
        type: MCP_MEDIA_TYPE,
        mediaType: MCP_MEDIA_TYPE,
        url: `${SITE_ORIGIN}/.well-known/mcp/server-card.json`,
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
      {
        identifier: OKF_ENTRY_URN,
        displayName: 'Stoicism knowledge bundle (OKF)',
        type: OKF_MEDIA_TYPE,
        mediaType: OKF_MEDIA_TYPE,
        url: `${SITE_ORIGIN}/okf.tar.gz`,
        description: "An Open Knowledge Format v0.1 bundle of this site's Stoic library — concepts, persons, works, and Seneca's letters as cross-linked Markdown — generated from the same data as the EntityMap.",
        tags: ['stoicism', 'philosophy', 'okf', 'knowledge'],
        representativeQueries: [
          'stoic dichotomy of control',
          'seneca on the shortness of life',
          'marcus aurelius on memento mori',
        ],
        version: '0.1',
        updatedAt: now,
      },
    ],
  };
}
