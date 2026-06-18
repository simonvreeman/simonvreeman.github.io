import fs from 'node:fs';
import path from 'node:path';
import { stripTags, firstSentencesWithin } from './text.mjs';
import { WORK_TYPE } from '../data/vocabulary.mjs';
import { publisher } from '../data/publisher.mjs';

const LETTER_RE = /^letter-(\d+)\.html$/; // excludes the malformed "letter-.html"

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]) : '';
}
function firstParagraph(html) {
  const body = html.replace(/<header[\s\S]*?<\/header>/i, '');
  for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = stripTags(m[1]);
    if (t.length > 80) return t; // first substantive paragraph
  }
  return '';
}

// Page <title>s carry an emoji prefix and a " - Seneca" suffix; strip them for the entity name
// (the raw title is kept verbatim as the chunk's pageTitle for provenance).
function cleanTitle(raw) {
  return raw
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/\s*[-–—]\s*Seneca\s*$/i, '')
    .trim();
}

export function bootstrapLetters(senecaDir) {
  const out = [];
  for (const file of fs.readdirSync(senecaDir).sort()) {
    const match = file.match(LETTER_RE);
    if (!match) continue;
    const n = Number(match[1]);
    const html = fs.readFileSync(path.join(senecaDir, file), 'utf8');
    const rawTitle = extractTitle(html) || `Letter ${n}`;
    const name = cleanTitle(rawTitle) || `Letter ${n}`;
    const subject = name.replace(/^Letter\s+\d+:\s*/i, '');
    const para = firstParagraph(html);
    if (!para) continue; // skip empty/odd pages rather than emit an invalid chunk
    const text = firstSentencesWithin(para, 600);
    out.push({
      entityId: `seneca-letter-${n}`,
      '@type': WORK_TYPE,
      name,
      description: `Letter ${n} of Seneca's Moral Letters to Lucilius: "${subject}".`,
      relations: [
        { predicate: 'PART_OF', targetId: 'work-moral-letters', targetName: 'Moral Letters to Lucilius' },
        { predicate: 'AUTHORED_BY', targetId: 'person-seneca', targetName: 'Seneca the Younger' },
      ],
      hasChunks: [{
        chunkId: `seneca-letter-${n}-c1`,
        text,
        sourceUrl: `https://vreeman.com/seneca/letter-${n}`,
        pageTitle: rawTitle,
        publisher: publisher.name,
        contentType: 'evidence',
        relevanceScore: 0.7,
      }],
    });
  }
  return out;
}
