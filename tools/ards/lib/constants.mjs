export const SPEC_VERSION = '1.0';
export const DID = 'did:web:vreeman.com';
export const CATALOG_PATH = '.well-known/ai-catalog.json';
export const DID_PATH = '.well-known/did.json';
// urn:ai:<publisher>:<namespace>:<name> — RFC 8141 domain-anchored URN
export const URN_RE = /^urn:ai:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/;
// Spec/schema value. The only live ARDS catalog in the wild (suganthan.com) uses
// 'application/mcp-server-card+json'. We emit the spec value; flip here if a validator rejects it.
export const MCP_MEDIA_TYPE = 'application/mcp-server+json';
