import { SPEC_VERSION, URN_RE } from './constants.mjs';

export function validate(doc) {
  const errors = [];
  const warnings = [];
  if (doc.specVersion !== SPEC_VERSION) errors.push(`specVersion must be "${SPEC_VERSION}"`);
  if (!Array.isArray(doc.entries) || doc.entries.length < 1) errors.push('entries must be a non-empty array');
  if (doc.host) {
    if (!doc.host.displayName) errors.push('host.displayName required when host is present');
    if (doc.host.trustManifest && !doc.host.trustManifest.identity) errors.push('host.trustManifest.identity required when trustManifest is present');
  }
  for (const [i, e] of (doc.entries || []).entries()) {
    if (!e.identifier) errors.push(`entries[${i}].identifier required`);
    else if (!URN_RE.test(e.identifier)) errors.push(`entries[${i}].identifier must match urn:ai: pattern`);
    if (!e.displayName) errors.push(`entries[${i}].displayName required`);
    if (!e.type) errors.push(`entries[${i}].type required`);
    if ((e.url != null) === (e.data != null)) errors.push(`entries[${i}] must contain exactly one of url or data`);
    if (e.trustManifest && !e.trustManifest.identity) errors.push(`entries[${i}].trustManifest.identity required`);
    if (e.representativeQueries && (e.representativeQueries.length < 2 || e.representativeQueries.length > 5)) {
      warnings.push(`entries[${i}].representativeQueries SHOULD contain 2-5 items`);
    }
  }
  return { errors, warnings };
}
