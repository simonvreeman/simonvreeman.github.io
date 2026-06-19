import { parseFrontmatter } from './frontmatter.mjs';

// files: Map<relativePath, content>. Encodes OKF v0.1 §9 conformance.
export function validateBundle(files) {
  const errors = [];
  for (const [rel, content] of files) {
    // OKF conformance applies only to Markdown concept docs; non-.md files
    // (e.g. the human landing index.html) are out-of-band host conveniences.
    if (!rel.endsWith('.md')) continue;
    const base = rel.split('/').pop();
    if (base === 'index.md') {
      const fm = parseFrontmatter(content);
      if (rel === 'index.md') {
        if (fm && Object.keys(fm).some(k => k !== 'okf_version')) {
          errors.push(`${rel}: bundle-root index.md may only carry okf_version`);
        }
      } else if (fm) {
        errors.push(`${rel}: index.md must not contain frontmatter`);
      }
    } else if (base === 'log.md') {
      if (!/^##\s+\d{4}-\d{2}-\d{2}/m.test(content)) errors.push(`${rel}: log.md needs an ISO ## YYYY-MM-DD heading`);
    } else {
      const fm = parseFrontmatter(content);
      if (!fm) errors.push(`${rel}: missing or unparseable YAML frontmatter`);
      else if (!fm.type || !fm.type.replace(/"/g, '').trim()) errors.push(`${rel}: frontmatter "type" is required and must be non-empty`);
    }
  }
  return { errors };
}
