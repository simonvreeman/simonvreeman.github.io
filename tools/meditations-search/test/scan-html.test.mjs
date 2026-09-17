import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, stripTags, scanBooks } from '../lib/scan-html.mjs';

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

test('stripTags drops sup and return links, keeps mark text', () => {
  const html = '<p><a href="#book2-1" class="return" title="Meditations 2.1">&#167;</a> '
    + '<strong id="book2-1">2.1</strong> <mark title="The Daily Stoic: January 1st">Be tolerant</mark>'
    + ' with others<sup><a href="#note1">i</a></sup>.</p>';
  const text = stripTags(html).replace(/\s+/g, ' ').trim();
  // The § return link and the footnote marker's "i" are gone; <mark>'s body text and the title-less
  // punctuation around it survive. The title attribute is never part of textContent, so never indexed.
  assert.equal(text, '2.1 Be tolerant with others.');
});

test('stripTags pads block boundaries so words do not fuse', () => {
  // textContent joins nodes with nothing between them, so "world.</li><li>My" must not fuse.
  const text = stripTags('<ul><li>the world.</li><li>My own.</li></ul>');
  assert.ok(/world\.\s+My/.test(text), `block boundary kept a space: ${JSON.stringify(text)}`);
  assert.ok(/before\s+after/.test(stripTags('<p>before<br>after</p>')), '<br> counts as a space');
});

test('scanBooks finds a Book 1 h3 marker', () => {
  // Book 1's § link carries no class="return" (Books 2–12's does), so it survives here exactly as it
  // survives visibleText() in the browser. groupEntries() strips the leading "§ 1.1" from both.
  const html = `<main><section id="book1">
    <h2>Book 1</h2>
    <h3 id="book1-1"><a href="#book1-1">&#167;</a> 1.1 My grandfather Verus <sup><a href="#v">i</a></sup></h3>
    <p>Character and self-control.</p>
  </section></main>`;
  assert.deepEqual(scanBooks(html), [
    { marker: 'book1-1', text: '§ 1.1 My grandfather Verus' },
    { marker: null, text: 'Character and self-control.' },
  ]);
});

test('scanBooks finds a Books 2-12 strong marker and a lettered sub-entry', () => {
  const html = `<main><section id="book4">
    <h2>Book 4</h2>
    <p><a href="#book4-49" class="return">&#167;</a> <strong id="book4-49">4.49</strong> Be like the rock.</p>
    <p><a href="#book4-49a" class="return">&#167;</a> <strong id="book4-49a">4.49a</strong> Or say instead.</p>
  </section></main>`;
  const items = scanBooks(html);
  assert.deepEqual(items.map(i => i.marker), ['book4-49', 'book4-49a']);
  assert.deepEqual(items.map(i => i.text), ['4.49 Be like the rock.', '4.49a Or say instead.']);
});

test('scanBooks ignores sections that are not Books', () => {
  const html = `<main>
    <section id="introduction"><p>By Gregory Hays.</p></section>
    <section id="book1"><h2>Book 1</h2><h3 id="book1-1">1.1 Verus</h3></section>
    <section id="notes"><p>Loeb edition.</p></section>
  </main>`;
  assert.deepEqual(scanBooks(html).map(i => i.marker), ['book1-1']);
});

test('scanBooks keeps a nested list whole instead of cutting it at the inner close', () => {
  // Entry 12.24 really does carry <ol><li><ol>. A non-greedy /<ol>[\s\S]*?<\/ol>/ ends the outer list
  // at the inner list's </ol>, which drops 470 characters of that entry from the corpus.
  const html = `<main><section id="book6">
    <p><a href="#book6-1" class="return">&#167;</a> <strong id="book6-1">6.1</strong> Consider:</p>
    <ol><li>outer one<ol><li>inner one</li></ol></li><li>outer two</li></ol>
    <p>tail paragraph.</p>
  </section></main>`;
  const items = scanBooks(html);
  assert.deepEqual(items.map(i => i.marker), ['book6-1', null, null]);
  assert.equal(items[1].text, 'outer one inner one outer two');
  assert.equal(items[2].text, 'tail paragraph.');
});

test('scanBooks keeps a blockquote and its paragraphs as one item', () => {
  const html = `<main><section id="book7">
    <blockquote><p>First line.</p><p>Second line.</p></blockquote>
  </section></main>`;
  assert.deepEqual(scanBooks(html), [{ marker: null, text: 'First line. Second line.' }]);
});

test('scanBooks reads only <main>, matching buildIndex\'s `main > section[id]`', () => {
  const html = `<body><section id="book9"><p><strong id="book9-1">9.1</strong> Out of band.</p></section>
    <main><section id="book1"><h3 id="book1-1">1.1 Verus</h3></section></main></body>`;
  assert.deepEqual(scanBooks(html).map(i => i.marker), ['book1-1']);
  assert.throws(() => scanBooks('<section id="book1"></section>'), /no <main>/);
});
