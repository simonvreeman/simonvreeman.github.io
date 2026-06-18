// Renders entitymap.html — a human/crawler-readable view GENERATED from entitymap.json.
// Never hand-maintained. The build orchestrator calls renderHtml(doc) and writes the result.
//
// EntityMap v1.0 spec §9 requires a conforming entitymap.html to:
//   1. Reference entitymap.json via <link rel="alternate" type="application/json">.
//   2. Embed per-entity JSON-LD in <script type="application/ld+json"> blocks.
//   3. Render relations as internal hyperlinks where targets exist in the same file.
//   4. Include a data-publisher attribute on every chunk blockquote.
//   5. Render the publisher name as visible plain text in every chunk's <cite>:
//      pattern "[page title] — published by [publisher name]".
//   6. Not carry a noindex directive.
//
// Item 2 (JSON-LD <script> blocks) is intentionally NOT emitted: the mandated test
// asserts the output contains no <script> tags, and this unit is required to stay
// script-free. The machine-readable structured data lives in entitymap.json, which
// item 1 links to via rel="alternate". See the report for this deviation.

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderHtml(doc) {
  const pub = doc.publisher || {};
  const entities = doc.entities || [];
  const jsonUrl = `${pub.url || ''}entitymap.json`;
  // Targets that exist in this file, so relations can become internal hyperlinks (spec §9.3).
  const localTargets = new Set(entities.map((e) => e.entityId).filter(Boolean));
  const anchor = (id) => `entity-${esc(id)}`;
  const out = [];
  out.push('<!doctype html>');
  out.push('<html lang="en">');
  out.push('<head>');
  out.push('<meta charset="utf-8">');
  out.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  // Spec §9.6: must NOT carry a noindex directive — advertise indexable, follow.
  out.push('<meta name="robots" content="index, follow">');
  out.push(`<title>EntityMap — ${esc(pub.name)}</title>`);
  // Spec §9.1: reference the machine-readable companion via rel="alternate".
  out.push(`<link rel="alternate" type="application/json" href="${esc(jsonUrl)}">`);
  out.push('<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;line-height:1.55}section{margin:1.5rem 0;border-top:1px solid #ddd;padding-top:1rem}blockquote{margin:.5rem 0;padding-left:1rem;border-left:3px solid #ccc;color:#333}.type{color:#666;font-size:.85em}ul{margin:.3rem 0}cite{color:#666;font-size:.85em}</style>');
  out.push('</head>');
  out.push('<body>');
  // Plain-text attribution: keep the publisher identity in readable text, not only in attributes.
  out.push(`<h1>EntityMap for ${esc(pub.name)}</h1>`);
  out.push(`<p>This EntityMap is published by ${esc(pub.name)} (${esc(pub.url)}). It declares the entities this site is authoritative about, how they relate, and where the supporting evidence lives. Machine-readable version: <a href="${esc(jsonUrl)}">entitymap.json</a>.</p>`);
  out.push(`<p>Version ${esc(doc.version)} · generated ${esc(doc.generated)} · ${esc(String(entities.length))} entities · publisher: ${esc(pub.name)}.</p>`);

  for (const e of entities) {
    out.push(e.entityId ? `<section id="${anchor(e.entityId)}">` : '<section>');
    out.push(`<h2>${esc(e.name)}</h2>`);
    out.push(`<p class="type">${esc(e['@type'])}${e.entityId ? ` · ${esc(e.entityId)}` : ''}</p>`);
    if (e.description) out.push(`<p>${esc(e.description)}</p>`);
    const sameAs = Array.isArray(e.sameAs) ? e.sameAs : (e.sameAs ? [e.sameAs] : []);
    if (sameAs.length) out.push(`<p>Same as: ${sameAs.map((u) => `<a href="${esc(u)}">${esc(u)}</a>`).join(', ')}</p>`);
    if (Array.isArray(e.relations) && e.relations.length) {
      out.push('<ul>');
      for (const r of e.relations) {
        // Spec §9.3: render relations as internal hyperlinks when the target exists in this file.
        const target = r.targetId && localTargets.has(r.targetId)
          ? `<a href="#${anchor(r.targetId)}">${esc(r.targetName)}</a>`
          : esc(r.targetName);
        out.push(`<li>${esc(r.predicate)} → ${target}${r.confidence ? ` (${esc(r.confidence)})` : ''}</li>`);
      }
      out.push('</ul>');
    }
    for (const c of e.hasChunks || []) {
      // Spec §9.4: data-publisher attribute on every chunk blockquote.
      // Spec §9.5: visible plain-text attribution in <cite> — "[page title] — published by [publisher]".
      out.push(`<blockquote data-publisher="${esc(c.publisher)}">${esc(c.text)}<br><cite><a href="${esc(c.sourceUrl)}">${esc(c.pageTitle)}</a> — published by ${esc(c.publisher)}</cite></blockquote>`);
    }
    out.push('</section>');
  }
  out.push('</body>');
  out.push('</html>');
  return out.join('\n') + '\n';
}
