import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLanding } from '../lib/render-landing.mjs';

const sections = [
  { dir: 'concepts', title: 'Concepts', description: 'Core doctrines.', items: [{ title: 'Stoicism', href: 'https://vreeman.com/meditations/' }] },
];

test('renders an HTML doc with the machine entry and section links', () => {
  const html = renderLanding(sections, '2026-06-19T00:00:00.000Z');
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<title>[^<]*Open Knowledge Format[^<]*<\/title>/);
  assert.match(html, /href="index\.md"/); // machine entry point
  assert.match(html, /<h2>Concepts<\/h2>/);
  assert.match(html, /href="https:\/\/vreeman\.com\/meditations\/">Stoicism<\/a>/);
  assert.match(html, /href="concepts\/index\.md"/); // per-section OKF index
});

test('escapes HTML in titles and descriptions', () => {
  const html = renderLanding(
    [{ dir: 'x', title: 'A & B', description: 'd', items: [{ title: '<i>t</i>', href: 'h' }] }],
    '2026-06-19T00:00:00.000Z',
  );
  assert.match(html, /A &amp; B/);
  assert.match(html, /&lt;i&gt;t&lt;\/i&gt;/);
  assert.ok(!html.includes('<i>t</i>'));
});
