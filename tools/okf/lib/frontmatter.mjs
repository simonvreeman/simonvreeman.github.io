function needsQuote(s) {
  // A colon only breaks YAML when followed by whitespace/end (so `https://x` is safe,
  // but `Letter 1: On Saving Time` is not). Other specials always force quoting.
  return /:(\s|$)/.test(s) || /[#\[\]{}",&*?|<>=!%@`]/.test(s) || /^\s|\s$/.test(s) || s === '';
}
function yamlScalar(v) {
  const s = String(v);
  return needsQuote(s) ? JSON.stringify(s) : s;
}

// Serialize a flat object to a YAML frontmatter block. `tags` is rendered as a flow list.
export function serializeFrontmatter(obj) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.map(yamlScalar).join(', ')}]`);
    else lines.push(`${k}: ${yamlScalar(v)}`);
  }
  lines.push('---');
  return lines.join('\n');
}

// Minimal parser: enough to validate generated files (key: scalar pairs).
export function parseFrontmatter(md) {
  if (!md.startsWith('---\n')) return null;
  const end = md.indexOf('\n---', 4);
  if (end === -1) return null;
  const obj = {};
  for (const line of md.slice(4, end + 1).split('\n')) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (m) obj[m[1]] = m[2];
  }
  return obj;
}
