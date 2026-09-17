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
        // Semantic hints for registries, not literal search strings — 'seneca letters on the fear
        // of death' would not match verbatim either. But the two Meditations queries are phrased in
        // the idiom of the edition this site actually publishes, Gregory Hays. The obvious
        // alternatives are George Long's 1862 wording and find nothing here: Long's 4.3 has people
        // seeking "retreats for themselves", where Hays has "People try to get away from it
        // all—to the country, to the beach, to the mountains", and 5.20's famous Hays line is
        // "What stands in the way becomes the way". Advertising the wrong translation's idiom for
        // the one work this catalog indexes is how an agent arrives with a query that cannot hit.
        // The same mistake reached the tool's own inputSchema in the previous task.
        //
        // Keep this list at five: the validator warns outside 2–5.
        representativeQueries: [
          'seneca letters on the fear of death',
          'epictetus dichotomy of control',
          'GA4 UTM campaign URL builder',
          'marcus aurelius on getting away from it all',
          'what stands in the way becomes the way',
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
