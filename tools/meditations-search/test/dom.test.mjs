import test from 'node:test';
import assert from 'node:assert/strict';
import { h, fire, Document } from './fake-dom.mjs';
import { visibleText, itemFromElement, buildIndex, mountSearch } from '../../../meditations/search.js';

test('visibleText keeps words apart across li and p even with no whitespace between tags', () => {
  const ul = h('ul', {}, h('li', {}, 'The nature of the world.'), h('li', {}, 'My nature.'));
  assert.equal(visibleText(ul), 'The nature of the world. My nature.');
  const bq = h('blockquote', {}, h('p', {}, 'If I cannot move the gods'), h('p', {}, 'The gods must have their reasons'));
  assert.equal(visibleText(bq), 'If I cannot move the gods The gods must have their reasons');
  // Both sides of a block are padded, so bare text before or after it stays apart too.
  assert.equal(visibleText(h('div', {}, 'lead', h('p', {}, 'mid'), 'tail')), 'lead mid tail');
});

test('visibleText drops footnote markers and § return links and treats br as a space', () => {
  const p = h('p', {},
    h('a', { href: '#book2-1', class: 'return' }, '§'), ' ',
    h('strong', { id: 'book2-1' }, '2.1'), ' Zeus, rain down', h('br'), 'On the land', h('sup', {}, h('a', { href: '#zeus' }, 'i')));
  assert.equal(visibleText(p), '2.1 Zeus, rain down On the land');
});

test('itemFromElement reads the marker from an h3 id or from the first strong[id] inside', () => {
  const h3 = h('h3', { id: 'book1-1' }, '§ 1.1 My grandfather Verus');
  assert.deepEqual(itemFromElement(h3), { marker: 'book1-1', text: '§ 1.1 My grandfather Verus' });
  const p = h('p', {}, h('strong', { id: 'book2-1' }, '2.1'), ' Hi');
  assert.deepEqual(itemFromElement(p), { marker: 'book2-1', text: '2.1 Hi' });
  assert.deepEqual(itemFromElement(h('p', {}, 'continuation')), { marker: null, text: 'continuation' });
});

test('buildIndex indexes only Book sections that are direct children of main', () => {
  const doc = new Document();
  doc.body.append(h('main', {},
    h('section', { id: 'introduction' }, h('p', {}, 'Hays')),
    h('section', { id: 'book2' },
      h('h2', {}, 'Book 2'),
      h('p', {}, h('a', { class: 'return' }, '§'), ' ', h('strong', { id: 'book2-1' }, '2.1'), ' When you wake up.'),
      h('ul', {}, h('li', {}, 'The nature of the world.'), h('li', {}, 'My nature.'))),
    h('section', { id: 'notes' }, h('p', {}, 'Hays')), // follows a Book, as #notes does on the real page
    h('div', {}, h('section', { id: 'book3' }, h('p', {}, h('strong', { id: 'book3-1' }, '3.1'), ' nested, so ignored')))));
  const entries = buildIndex(doc);
  assert.deepEqual(entries.map(e => e.id), ['book2-1']);
  assert.equal(entries[0].text, 'When you wake up. The nature of the world. My nature.');
});

const WIDGET_IDS = ['search-toggle', 'search-panel', 'search-input', 'search-status', 'search-results'];

// A page with the real template structure and one two-entry Book. Any of the five ids can be overridden
// to simulate a bad hand edit; `narrow` drives matchMedia('(max-width: 60em)').
function page(ids = {}, { narrow = false, visualViewport = null } = {}) {
  const id = name => ids[name] ?? name;
  const doc = new Document();
  const header = h('header', { id: 'header' }, h('a', { href: '#introduction', class: 'skip-to-main-content-link' }, 'Skip'));
  const main = h('main', {}, h('section', { id: 'book2' },
    h('h2', {}, 'Book 2'),
    h('p', {}, h('strong', { id: 'book2-1' }, '2.1'), ' Tranquillity comes from within.'),
    h('p', {}, h('strong', { id: 'book2-2' }, '2.2'), ' Throw away your books.')));
  const root = h('div', { id: 'search', class: 'search' },
    h('button', { id: id('search-toggle'), type: 'button', 'aria-expanded': 'false' }),
    h('div', { id: id('search-panel'), hidden: '' },
      h('input', { id: id('search-input'), type: 'search' }),
      h('p', { id: id('search-status') }),
      h('ol', { id: id('search-results') })));
  const template = h('template', { id: 'search-template' });
  template.content = h('#fragment', {}, root);
  doc.body.append(header, main, template);
  doc.defaultView.matchMedia = () => ({ matches: narrow });
  if (visualViewport) doc.defaultView.visualViewport = visualViewport;
  return doc;
}

// Mount, open via the icon, and type a query; returns the live elements.
function opened(doc, query) {
  const root = mountSearch(doc);
  const el = name => root.querySelector(`#${name}`);
  fire(el('search-toggle'), 'click');
  if (query !== undefined) { el('search-input').value = query; fire(el('search-input'), 'input'); }
  return { root, toggle: el('search-toggle'), panel: el('search-panel'), input: el('search-input'), status: el('search-status'), results: el('search-results') };
}

test('mountSearch places the widget right after the header so the toggle is an early Tab stop', () => {
  const doc = page();
  const root = mountSearch(doc);
  assert.equal(root.id, 'search');
  assert.deepEqual(doc.body.children.map(e => e.tagName), ['HEADER', 'DIV', 'MAIN', 'TEMPLATE']);
});

test('mountSearch leaves the page untouched when the template lacks any of the five ids', () => {
  for (const name of WIDGET_IDS) {
    const doc = page({ [name]: `${name}-x` });
    assert.equal(mountSearch(doc), null, name);
    assert.deepEqual(doc.body.children.map(e => e.tagName), ['HEADER', 'MAIN', 'TEMPLATE'], name);
  }
});

test('mountSearch returns null when there is no template', () => {
  const doc = new Document();
  assert.equal(mountSearch(doc), null);
});

test('opening focuses the field and typing renders one linked row per match', () => {
  const doc = page();
  const { panel, input, status, results } = opened(doc, 'tranquillity');
  assert.equal(panel.hidden, false);
  assert.equal(doc.activeElement, input);
  assert.equal(results.children.length, 1);
  assert.equal(results.querySelector('a').href, '#book2-1');
  assert.equal(results.querySelector('strong').textContent, '2.1');
  assert.equal(results.querySelector('mark').textContent, 'Tranquillity');
  assert.equal(status.textContent, '1 entry matches');
  input.value = 'zzz'; fire(input, 'input');
  assert.equal(status.textContent, 'No entries match');
  assert.equal(results.children.length, 0);
  input.value = 'b'; fire(input, 'input'); // below MIN_QUERY: no status, no rows
  assert.equal(status.textContent, '');
  assert.equal(results.children.length, 0);
});

test('typing before the panel was ever opened still renders (the index is built on demand)', () => {
  const root = mountSearch(page());
  const input = root.querySelector('#search-input');
  input.value = 'books'; fire(input, 'input');
  assert.equal(root.querySelector('#search-results').children.length, 1);
});

test('the index is built once, not per keystroke', () => {
  const doc = page();
  let walks = 0;
  const orig = doc.querySelectorAll.bind(doc);
  doc.querySelectorAll = sel => { if (sel === 'main > section[id]') walks++; return orig(sel); };
  const { input } = opened(doc, 'books');
  input.value = 'book'; fire(input, 'input');
  assert.equal(walks, 1);
});

test('Cmd/Ctrl+K opens and focuses the field; clicking the icon again closes and refocuses it', () => {
  const doc = page();
  const root = mountSearch(doc);
  const el = name => root.querySelector(`#${name}`);
  const ev = fire(doc.body, 'keydown', { key: 'k', metaKey: true });
  assert.equal(el('search-panel').hidden, false);
  assert.equal(doc.activeElement, el('search-input'));
  assert.equal(ev.defaultPrevented, true);
  fire(el('search-toggle'), 'click');
  assert.equal(el('search-panel').hidden, true);
  assert.equal(doc.activeElement, el('search-toggle'));
});

test('a result click closes the panel only on narrow viewports', () => {
  const wide = opened(page(), 'books');
  fire(wide.results.querySelector('a'), 'click');
  assert.equal(wide.panel.hidden, false);
  const narrow = opened(page({}, { narrow: true }), 'books');
  fire(narrow.results, 'click'); // the list's own box is not a result
  assert.equal(narrow.panel.hidden, false);
  fire(narrow.results.querySelector('mark'), 'click'); // a real tap lands on the row's text, not the <a>
  assert.equal(narrow.panel.hidden, true);
});

test('Escape returns focus to the icon when focus was on the field', () => {
  const doc = page();
  const { toggle, panel, input } = opened(doc, 'books');
  const ev = fire(input, 'keydown', { key: 'Escape' });
  assert.equal(panel.hidden, true);
  assert.equal(doc.activeElement, toggle);
  assert.equal(ev.defaultPrevented, true);
});

test('Escape from a result link reached with Enter returns focus to the icon', () => {
  const doc = page();
  const { toggle, panel, input, results } = opened(doc, 'books');
  fire(input, 'keydown', { key: 'Enter' });
  const link = results.querySelector('a');
  assert.equal(doc.activeElement, link);
  fire(link, 'keydown', { key: 'Escape' });
  assert.equal(panel.hidden, true);
  assert.equal(doc.activeElement, toggle);
});

test('Escape leaves focus on the page when a result click already moved it there', () => {
  const doc = page();
  const { panel } = opened(doc, 'books');
  doc.activeElement = doc.body; // fragment navigation after Enter on a result clears the focused element
  fire(doc.body, 'keydown', { key: 'Escape' });
  assert.equal(panel.hidden, true);
  assert.equal(doc.activeElement, doc.body);
});

test('a click outside closes the panel, a pointerdown alone (a scrollbar drag) does not', () => {
  const doc = page();
  const { panel } = opened(doc);
  const main = doc.querySelector('main');
  fire(main, 'pointerdown');
  assert.equal(panel.hidden, false, 'pointerdown outside must not close');
  fire(main, 'click');
  assert.equal(panel.hidden, true, 'click outside closes');
});

test('a drag that starts in the field and is released outside the panel does not close it', () => {
  const doc = page();
  const { panel, input } = opened(doc, 'books');
  fire(input, 'pointerdown');
  fire(doc.body, 'click', { detail: 1 }); // browsers dispatch the click on the common ancestor of mousedown and mouseup
  assert.equal(panel.hidden, false, 'a drag out of the field must not close');
  const main = doc.querySelector('main');
  fire(main, 'pointerdown'); fire(main, 'click', { detail: 1 });
  assert.equal(panel.hidden, true, 'a real click outside still closes');
});

test('a press inside that never becomes a click does not swallow the next keyboard click outside', () => {
  const doc = page();
  const { panel, input } = opened(doc, 'books');
  fire(input, 'pointerdown', { button: 2 }); // right-click to paste: contextmenu, no click
  fire(doc.querySelector('.skip-to-main-content-link'), 'click', { detail: 0 }); // Enter on a link reached by Tab
  assert.equal(panel.hidden, true);
});

test('Enter in the field moves focus to the first result and does nothing without results', () => {
  const doc = page();
  const { input, results } = opened(doc, 'books');
  const ev = fire(input, 'keydown', { key: 'Enter' });
  const link = results.querySelector('a');
  assert.equal(doc.activeElement, link);
  assert.equal(ev.defaultPrevented, true);
  const again = fire(link, 'keydown', { key: 'Enter' });
  assert.equal(again.defaultPrevented, false, 'Enter on a result is left to the browser, which follows the link');
  assert.equal(doc.activeElement, link);
  input.value = 'zzz'; fire(input, 'input');
  input.focus();
  fire(input, 'keydown', { key: 'Enter' });
  assert.equal(doc.activeElement, input);
});

test('Enter and Escape that commit or cancel an IME composition are ignored', () => {
  const doc = page();
  const { panel, input } = opened(doc, 'books');
  for (const init of [{ key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }]) {
    const ev = fire(input, 'keydown', init);
    assert.equal(doc.activeElement, input, JSON.stringify(init));
    assert.equal(ev.defaultPrevented, false, JSON.stringify(init));
  }
  for (const init of [{ key: 'Escape', isComposing: true }, { key: 'Escape', keyCode: 229 }]) {
    fire(input, 'keydown', init);
    assert.equal(panel.hidden, false, JSON.stringify(init));
  }
});

test('the widget exposes the layout-viewport height minus the keyboard so the panel can avoid it', () => {
  const listeners = [];
  // visualViewport.height shrinks with pinch-zoom as well as with the keyboard; height * scale factors the zoom out.
  const vv = { height: 254, scale: 2, addEventListener: (type, fn) => { if (type === 'resize') listeners.push(fn); } };
  const doc = page({}, { visualViewport: vv });
  const root = mountSearch(doc);
  assert.equal(root.style.getPropertyValue('--vvh'), '508px');
  vv.height = 300;
  listeners.forEach(fn => fn());
  assert.equal(root.style.getPropertyValue('--vvh'), '600px');
});
