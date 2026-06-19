// Human-readable landing page for the OKF bundle, served as okf/index.html so that
// https://vreeman.com/okf/ resolves in a browser (static hosts use index.html as the
// directory index; the OKF machine entry point remains index.md). OKF consumers ignore
// non-.md files, so this page is invisible to them.

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// sections: [{ dir, title, description, items: [{ title, href }] }]
export function renderLanding(sections, now) {
  const date = now.slice(0, 10);
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const out = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Open Knowledge Format bundle — Vreeman.com</title>',
    '<meta name="description" content="An Open Knowledge Format (OKF) v0.1 bundle of the Vreeman.com Stoic library, for AI agents and humans.">',
    '<link rel="canonical" href="https://vreeman.com/okf/">',
    '<style>body{font:1.05em/1.6 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}h1{line-height:1.2}h2{margin-top:2rem}code{background:#f2f2f2;padding:.1em .3em;border-radius:3px}a{color:#0b5fff}ul{padding-left:1.2rem}.muted{color:#666;font-size:.9em}</style>',
    '</head>',
    '<body>',
    '<h1>Open Knowledge Format bundle</h1>',
    `<p>An <a href="https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/HEAD/okf/SPEC.md">Open Knowledge Format</a> (OKF v0.1) bundle of the <a href="https://vreeman.com/">Vreeman.com</a> Stoic library — ${total} concept documents, generated from the same data as the site&#39;s <a href="https://vreeman.com/entitymap.html">EntityMap</a>.</p>`,
    '<p class="muted">Machine-readable entry point for agents: <a href="index.md"><code>index.md</code></a> — hand an agent that file and it walks the bundle from there. The links below point to the canonical pages for human reading.</p>',
  ];
  for (const s of sections) {
    out.push(`<h2>${esc(s.title)}</h2>`);
    out.push(`<p>${esc(s.description)} <a class="muted" href="${esc(s.dir)}/index.md">(OKF index)</a></p>`);
    out.push('<ul>');
    for (const it of s.items) out.push(`<li><a href="${esc(it.href)}">${esc(it.title)}</a></li>`);
    out.push('</ul>');
  }
  out.push(`<p class="muted">Generated ${date}. This page and the bundle are produced by <code>tools/okf/build.mjs</code> — do not hand-edit.</p>`);
  out.push('</body>');
  out.push('</html>');
  return out.join('\n') + '\n';
}
