// The shipped .well-known/agent-skills/index.json against the Agent Skills Discovery RFC v0.2.0
// (https://github.com/cloudflare/agent-skills-discovery-rfc) and against the generator that writes
// it. A digest that has drifted from the artefact it names is the failure mode the whole spec exists
// to prevent — a conformant client MUST reject content whose hash does not match — so the check that
// matters most is the cheap one: hash the bytes on disk and compare.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildIndex } from '../build.mjs';

const index = JSON.parse(readFileSync(new URL('../../../.well-known/agent-skills/index.json', import.meta.url), 'utf8'));

const skillMd = name => new URL(`../../../.well-known/agent-skills/${name}/SKILL.md`, import.meta.url);

test('the index declares the v0.2.0 schema', () => {
  assert.equal(index.$schema, 'https://schemas.agentskills.io/discovery/0.2.0/schema.json');
});

test('every digest matches the artefact it names', () => {
  for (const skill of index.skills) {
    const bytes = readFileSync(skillMd(skill.name));
    assert.equal(skill.digest, 'sha256:' + createHash('sha256').update(bytes).digest('hex'), skill.name);
  }
});

test('the shipped index is what the generator produces now', () => {
  assert.deepEqual(index, buildIndex());
});

test('each SKILL.md starts with name and description frontmatter', () => {
  for (const skill of index.skills) {
    const md = readFileSync(skillMd(skill.name), 'utf8');
    const fm = /^---\n([\s\S]*?)\n---/.exec(md);
    assert.ok(fm, `${skill.name} has frontmatter`);
    assert.match(fm[1], /^name: [a-z][a-z0-9-]{0,63}$/m);
    assert.match(fm[1], /^description: .+/m);
  }
});

// --- the rest of the RFC's normative requirements on an entry ---------------

test('the index has exactly the two top-level fields the RFC defines', () => {
  assert.deepEqual(Object.keys(index).sort(), ['$schema', 'skills']);
  assert.ok(Array.isArray(index.skills) && index.skills.length > 0, 'skills is a non-empty array');
});

test('every entry carries exactly the five required fields', () => {
  for (const skill of index.skills) {
    assert.deepEqual(Object.keys(skill).sort(), ['description', 'digest', 'name', 'type', 'url'], skill.name);
  }
});

// The RFC constrains `type` to "skill-md" or "archive", and says a skill that is only a SKILL.md
// SHOULD be "skill-md". Everything here is a lone SKILL.md, so anything else is a bug.
test('every entry is a skill-md pointing at its own SKILL.md', () => {
  for (const skill of index.skills) {
    assert.equal(skill.type, 'skill-md', skill.name);
    assert.equal(skill.url, `/.well-known/agent-skills/${skill.name}/SKILL.md`, skill.name);
  }
});

// Path-absolute, so it resolves against the index's origin under RFC 3986 §5 no matter which host
// an agent fetched the index from. A root-relative "vreeman-stoic-library/SKILL.md" would resolve
// too, but a hardcoded https://vreeman.com/... would break every mirror and preview deploy.
test('urls are path-absolute, not origin-locked', () => {
  for (const skill of index.skills) {
    assert.match(skill.url, /^\/\.well-known\//, skill.name);
  }
});

test('digests are sha256 with 64 lowercase hex chars', () => {
  for (const skill of index.skills) {
    assert.match(skill.digest, /^sha256:[0-9a-f]{64}$/, skill.name);
  }
});

// The Agent Skills naming spec: 1–64 chars, lowercase alphanumeric and hyphens, no leading,
// trailing or consecutive hyphens. Stricter than the frontmatter smoke test above.
test('names conform to the Agent Skills naming spec', () => {
  for (const skill of index.skills) {
    assert.match(skill.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, skill.name);
    assert.ok(skill.name.length <= 64, `${skill.name} is at most 64 chars`);
  }
});

test('names are unique', () => {
  const names = index.skills.map(s => s.name);
  assert.equal(new Set(names).size, names.length);
});

// The description is the only thing most agents ever read, and the RFC caps it at 1024 characters.
// It also SHOULD match the frontmatter, or an agent that loads the body gets a different promise
// than the one it selected on.
test('each description is within the 1024-char cap and matches its frontmatter', () => {
  for (const skill of index.skills) {
    assert.ok(skill.description.length > 0, `${skill.name} description is non-empty`);
    assert.ok(skill.description.length <= 1024, `${skill.name} description is at most 1024 chars`);
    const md = readFileSync(skillMd(skill.name), 'utf8');
    assert.equal(skill.description, /^description: (.+)$/m.exec(md)[1], skill.name);
  }
});

// "Must match the parent directory name" — agentskills.io/specification.
test('each frontmatter name matches its directory', () => {
  for (const skill of index.skills) {
    const md = readFileSync(skillMd(skill.name), 'utf8');
    assert.equal(/^name: (.+)$/m.exec(md)[1], skill.name);
  }
});

test('buildIndex is deterministic', () => {
  assert.deepEqual(buildIndex(), buildIndex());
});
