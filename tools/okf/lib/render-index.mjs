export function renderDirIndex(title, entries) {
  const lines = [`# ${title}`, ''];
  for (const e of entries) lines.push(`* [${e.title}](${e.file})${e.description ? ` - ${e.description}` : ''}`);
  return `${lines.join('\n')}\n`;
}

export function renderRootIndex(sections) {
  const lines = [
    '---', 'okf_version: "0.1"', '---',
    '# Vreeman.com — Stoicism (OKF bundle)', '',
    "An OKF v0.1 bundle of this site's Stoic library, for AI agents and humans. Generated from the same data as the site's EntityMap.", '',
  ];
  for (const s of sections) lines.push(`* [${s.title}](${s.dir}/) - ${s.description}`);
  return `${lines.join('\n')}\n`;
}
