const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const book = (id, title, author) => ({ id, title, author, category: 'Classic' });

test('classicCoverSVG embeds the book title as text, escaped', () => {
  const { classicCoverSVG } = load();
  const svg = classicCoverSVG(book('x1', 'Pride & Prejudice', 'Jane Austen'));
  assert.match(svg, /Pride &amp; Prejudice/);
  assert.match(svg, /<svg viewBox="0 0 300 450"/);
  assert.match(svg, /stroke="#C9A961"/);
});

test('classicCoverSVG wraps long titles and stays within the card', () => {
  const { classicCoverSVG, coverLines } = load();
  const lines = coverLines('Chronic (Long-Term) Pelvic Pain', 14);
  assert.ok(lines.length <= 4);
  const svg = classicCoverSVG(book('x2', 'Chronic (Long-Term) Pelvic Pain', 'RCOG'));
  const texts = (svg.match(/<tspan/g) || []).length;
  assert.ok(texts >= 2 && texts <= 6);
});

test('classicCoverSVG escapes xml and picks the image deterministically', () => {
  const { classicCoverSVG } = load();
  const a = classicCoverSVG(book('janeeyre', 'Jane Eyre', 'Charlotte Brontë'));
  const b = classicCoverSVG(book('janeeyre', 'Jane Eyre', 'Charlotte Brontë'));
  assert.equal(a, b);
  const images = ['classic-rose.jpg','classic-camellia.jpg','classic-peony.jpg'];
  assert.ok(images.some((n) => a.includes('assets/library/' + n)));
  assert.doesNotMatch(a, /&(?!amp;)/);
});
