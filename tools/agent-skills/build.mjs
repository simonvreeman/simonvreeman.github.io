// Generates .well-known/agent-skills/index.json — the Agent Skills discovery index, per the Agent
// Skills Discovery RFC v0.2.0 (https://github.com/cloudflare/agent-skills-discovery-rfc).
//
//   node tools/agent-skills/build.mjs
//
// The index is generated rather than written by hand for one reason: every entry carries a SHA-256
// digest of the SKILL.md it points at, and a conformant client MUST refuse content whose hash does
// not match. A hand-maintained digest goes stale the first time someone fixes a typo in the body,
// and the skill then fails closed everywhere, silently, for everyone. Deriving it from the bytes on
// disk makes that impossible; tools/agent-skills/test/digest.test.mjs then re-checks the shipped
// file, so a build that was never re-run is a red test rather than a broken index in production.
//
// Adding a skill means adding a directory with a SKILL.md and re-running this — there is no list of
// skills to keep in sync here.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SKILLS_DIR = '.well-known/agent-skills';
const INDEX_PATH = `${SKILLS_DIR}/index.json`;

// An opaque identifier, not a document to fetch: the RFC has clients match it against schema URIs
// they know and refuse to process an index whose version they do not recognise.
const SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

// agentskills.io/specification: 1–64 characters, lowercase alphanumeric and hyphens, no leading,
// trailing or consecutive hyphen. The RFC's `name` defers to that same rule.
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME = 64;
const MAX_DESCRIPTION = 1024;

// Frontmatter is a fenced block at the very top of the file — a `---` later in the body is a
// horizontal rule, not a delimiter, so the opening fence is anchored to byte 0.
const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/;

function field(frontmatter, key) {
  const m = new RegExp(`^${key}: (.+)$`, 'm').exec(frontmatter);
  return m ? m[1].trim() : null;
}

// One entry per skill directory. `bytes` stays a Buffer all the way to the digest: hashing a decoded
// string would hash whatever re-encoding Node chose, and for any non-ASCII byte — or a file with a
// BOM or CRLF endings — that is a different hash from the one a client computes over the response
// body. The RFC is explicit that the digest covers "the raw bytes of the skill's artifact".
function entry(name) {
  const rel = `${SKILLS_DIR}/${name}/SKILL.md`;
  const bytes = fs.readFileSync(path.join(REPO_ROOT, rel));

  const fm = FRONTMATTER.exec(bytes.toString('utf8'));
  if (!fm) throw new Error(`${rel}: no YAML frontmatter`);

  const declared = field(fm[1], 'name');
  const description = field(fm[1], 'description');
  if (!declared) throw new Error(`${rel}: frontmatter has no name`);
  if (!description) throw new Error(`${rel}: frontmatter has no description`);
  // The spec requires the two to agree, and the RFC's `url` is built from the directory: if they
  // disagree, an agent selects on one identity and loads a file claiming another.
  if (declared !== name) throw new Error(`${rel}: name "${declared}" does not match its directory "${name}"`);
  if (!NAME.test(name) || name.length > MAX_NAME) throw new Error(`${rel}: "${name}" is not a valid skill name`);
  if (description.length > MAX_DESCRIPTION) {
    throw new Error(`${rel}: description is ${description.length} characters, over the ${MAX_DESCRIPTION} cap`);
  }

  return {
    name,
    // Every skill here is a lone SKILL.md. "archive" is for skills that bundle scripts or
    // references, which would cost an agent a download and an unpack it does not need.
    type: 'skill-md',
    description,
    // Path-absolute, resolved against the index URL per RFC 3986 §5. A fully-qualified
    // https://vreeman.com/... would be wrong on a preview deploy or a mirror, which serve the same
    // index from another origin; a bare relative path would work but reads as less deliberate.
    url: `/${SKILLS_DIR}/${name}/SKILL.md`,
    digest: 'sha256:' + createHash('sha256').update(bytes).digest('hex'),
  };
}

// Sorted by name: readdirSync() order is filesystem-dependent, so without this the same tree can
// produce two different byte streams on two machines and the committed index churns for nothing.
export function buildIndex() {
  const names = fs
    .readdirSync(path.join(REPO_ROOT, SKILLS_DIR), { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(REPO_ROOT, SKILLS_DIR, d.name, 'SKILL.md')))
    .map(d => d.name)
    .sort();

  return { $schema: SCHEMA, skills: names.map(entry) };
}

function main() {
  let index;
  try {
    index = buildIndex();
  } catch (err) {
    console.error(`ERROR ${err.message}`);
    process.exit(1);
  }
  if (!index.skills.length) {
    console.error(`ERROR no skill directories under ${SKILLS_DIR} — not writing.`);
    process.exit(1);
  }
  fs.writeFileSync(path.join(REPO_ROOT, INDEX_PATH), JSON.stringify(index, null, 2) + '\n');
  const n = index.skills.length;
  console.log(`OK  ${n} ${n === 1 ? 'skill' : 'skills'} → ${INDEX_PATH}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
