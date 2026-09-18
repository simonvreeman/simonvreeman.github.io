import test from 'node:test';
import assert from 'node:assert/strict';
import { h, serialize, Document } from './fake-dom.mjs';
import { buildIndex, groupEntries, itemFromElement } from '../../../meditations/search.js';
import { decodeEntities, scanBooks } from '../lib/scan-html.mjs';

test('decodeEntities handles every entity the Books use', () => {
  assert.equal(decodeEntities('a&mdash;b'), 'a—b');
  assert.equal(decodeEntities('&#167; 2.1'), '§ 2.1');
  assert.equal(decodeEntities('wait&hellip;'), 'wait…');
  assert.equal(decodeEntities('&#35;'), '#');
  assert.equal(decodeEntities('&lt;i&gt;'), '<i>');
  assert.equal(decodeEntities('&ndash;'), '–');
});

test('decodeEntities throws on an entity it does not know', () => {
  // A silent passthrough would ship a literal "&amp;" into the agent corpus.
  assert.throws(() => decodeEntities('Tom &amp; Jerry'), /unknown entity/i);
});

// Each fixture below is authored once as an h() tree and checked both ways: through the DOM adapters in
// search.js, and through the scanner after serialising it to markup. Agreement with buildIndex is the
// only reason this module exists, so asserting it directly beats asserting hand-written expected strings.
// Items are compared before grouping too: groupEntries() strips a leading "§ N.M", which would hide a
// real difference — Book 1's § link carries no class="return", so unlike Books 2–12 its § is indexed.
function agree(...sections) {
  const doc = new Document();
  doc.body.append(h('main', {}, ...sections));
  const items = scanBooks(serialize(doc));
  const domItems = sections
    .filter(s => /^book\d+$/.test(s.id))
    .flatMap(s => s.children.filter(c => c.tagName !== 'H2').map(itemFromElement));
  assert.ok(domItems.length, 'the fixture actually produced items to compare');
  assert.deepEqual(items, domItems, 'scanner items match itemFromElement');
  const entries = groupEntries(items);
  assert.deepEqual(entries, buildIndex(doc), 'grouped entries match buildIndex');
  return entries;
}

// Book 1's § anchor has no class, so it is indexed; Books 2–12 use class="return", so theirs is not.
const sectionLink = (id, cls) => h('a', cls ? { href: `#${id}`, class: cls, title: `Meditations ${id}` }
                                            : { href: `#${id}`, title: `Meditations ${id}` }, '§');
const footnote = href => h('sup', {}, h('a', { href }, 'i'));

test('Book 1 h3 markers and their continuation paragraphs agree with the DOM walk', () => {
  const entries = agree(h('section', { id: 'book1' },
    h('h2', {}, h('a', { href: '#book1', title: 'Book 1' }, '#'), ' Book 1: Debts and Lessons'),
    h('h3', { id: 'book1-1' }, sectionLink('book1-1'), ' 1.1 My grandfather Verus ', footnote('#verus1')),
    h('p', {}, 'Character and self-control.'),
    h('h3', { id: 'book1-3' }, sectionLink('book1-3'), ' 1.3 My mother ', footnote('#lucilla')),
    h('p', {}, 'And the simple way she lived—not in the least like the rich.')));
  assert.deepEqual(entries.map(e => [e.id, e.label]), [['book1-1', '1.1'], ['book1-3', '1.3']]);
  assert.equal(entries[0].text, 'My grandfather Verus Character and self-control.');
});

test('Books 2-12 strong markers, .return links and a lettered sub-entry agree with the DOM walk', () => {
  const entries = agree(h('section', { id: 'book4' },
    h('h2', {}, 'Book 4'),
    h('p', {}, sectionLink('book4-49', 'return'), ' ', h('strong', { id: 'book4-49' }, '4.49'), ' Be like the rock.'),
    h('p', {}, sectionLink('book4-49a', 'return'), ' ', h('strong', { id: 'book4-49a' }, '4.49a'), ' Or say instead.')));
  assert.deepEqual(entries.map(e => [e.id, e.label]), [['book4-49', '4.49'], ['book4-49a', '4.49a']]);
  assert.equal(entries[0].text, 'Be like the rock.', 'the .return § never reaches the corpus');
});

test('mark text survives, sup and .return do not, and class="no-return" is left alone', () => {
  // .return is a class-token match: \breturn\b would also strip "no-return", diverging from the DOM.
  const entries = agree(h('section', { id: 'book5' },
    h('p', {}, sectionLink('book5-1', 'return'), ' ', h('strong', { id: 'book5-1' }, '5.1'), ' ',
      h('mark', { title: 'The Daily Stoic: January 1st' }, 'At dawn, when you have trouble'), ' getting out of bed',
      footnote('#dawn'), '.'),
    h('p', {}, sectionLink('book5-2', 'return  extra'), ' ', h('strong', { id: 'book5-2' }, '5.2'), ' Multi-token class.'),
    h('p', {}, h('a', { href: '#x', class: 'no-return' }, 'KEEPME'), ' ordinary link text.')));
  assert.equal(entries[0].text, 'At dawn, when you have trouble getting out of bed.');
  assert.ok(!entries[0].text.includes('Daily Stoic'), 'attribute text is never textContent');
  assert.equal(entries[1].text, 'Multi-token class. KEEPME ordinary link text.');
});

test('block boundaries, br and a nested list agree with the DOM walk', () => {
  // The <ol><li><ol> shape is entry 12.24's: a non-greedy /<ol>[\s\S]*?<\/ol>/ ends the outer list at
  // the inner list's close and loses 477 characters of that entry.
  const entries = agree(h('section', { id: 'book12' },
    h('h2', {}, 'Book 12'),
    h('p', {}, sectionLink('book12-24', 'return'), ' ', h('strong', { id: 'book12-24' }, '12.24'), ' Three things:'),
    h('ol', { class: 'roman' },
      h('li', {}, 'your own actions;',
        h('ol', { class: 'alpha' }, h('li', {}, 'not arbitrary'), h('li', {}, 'nor unjust'))),
      h('li', {}, 'external events.')),
    h('p', {}, 'And no matter how often you saw it', h('br'), 'it would be the same.'),
    h('blockquote', {}, h('p', {}, 'If I cannot move the gods'), h('p', {}, 'the gods must have their reasons'))));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].text, 'Three things: your own actions; not arbitrary nor unjust external events. '
    + 'And no matter how often you saw it it would be the same. '
    + 'If I cannot move the gods the gods must have their reasons');
});

test('entities survive the round trip and never re-enter as tags', () => {
  // &lt; and &gt; must be decoded after the tags are stripped, or the lacuna marks would eat the text.
  const entries = agree(h('section', { id: 'book4' },
    h('p', {}, h('strong', { id: 'book4-3' }, '4.3'), ' A quick visit wards off all < … > and sends you back—ready.')));
  assert.equal(entries[0].text, 'A quick visit wards off all < … > and sends you back—ready.');
});

test('only Book sections inside main are indexed, by both walks', () => {
  agree(h('section', { id: 'introduction' }, h('p', {}, 'By Gregory Hays.')),
        h('section', { id: 'book1' }, h('h3', { id: 'book1-1' }, '1.1 Verus')),
        h('section', { id: 'notes' }, h('p', {}, 'Loeb edition.')));

  // buildIndex() selects `main > section[id]`, so a Book outside <main> is on neither side.
  const doc = new Document();
  doc.body.append(
    h('section', { id: 'book9' }, h('p', {}, h('strong', { id: 'book9-1' }, '9.1'), ' Out of band.')),
    h('main', {}, h('section', { id: 'book1' }, h('h3', { id: 'book1-1' }, '1.1 Verus'))));
  assert.deepEqual(scanBooks(serialize(doc)).map(i => i.marker), ['book1-1']);
  assert.deepEqual(groupEntries(scanBooks(serialize(doc))), buildIndex(doc));
});

test('scanBooks throws on markup it cannot account for rather than dropping or re-splitting it', () => {
  const book = inner => `<main><section id="book2">${inner}</section></main>`;
  // A wrapper is the dangerous case: its children are not skipped, they are promoted to top level, so
  // one browser item would silently become two. The 499-marker count downstream cannot see that.
  assert.throws(() => scanBooks(book('<div><p>a</p><p>b</p></div>')), /unindexed markup in book2: <div>/);
  assert.throws(() => scanBooks(book('<table><tr><td>x</td></tr></table>')), /unindexed markup in book2/);
  assert.throws(() => scanBooks(book('<h4>Subheading</h4>')), /unindexed markup in book2/);
  assert.throws(() => scanBooks(book('<p>ok</p>loose text')), /unindexed markup in book2: loose text/);
  // Whitespace between children is the normal case and must not throw.
  assert.equal(scanBooks(book('\n  <p>ok</p>\n  <p>also ok</p>\n')).length, 2);
});

test('scanBooks throws on malformed markup rather than guessing', () => {
  assert.throws(() => scanBooks('<main><section id="book2"><p>unclosed</section></main>'), /unclosed <p>/);
  assert.throws(() => scanBooks('<main><section id="book2"></p></section></main>'), /unexpected <\/p>/);
  assert.throws(() => scanBooks('<main><section id="book2"><p>ok</p></main>'), /unclosed <section id="book2">/);
  assert.throws(() => scanBooks('<section id="book1"></section>'), /no <main>/);
});
