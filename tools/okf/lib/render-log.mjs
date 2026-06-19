export function renderLog(date, entityCount) {
  return [
    '# Log', '',
    `## ${date}`, '',
    `* **Initialization**: Created the OKF bundle with ${entityCount} concepts, generated from the site's EntityMap data.`,
    '',
  ].join('\n');
}
