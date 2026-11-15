const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

function its(str, x, y, w, h) {
  return { str, width: w, height: h, transform: [0, 0, 0, h, x, y] };
}

test('end-of-page unfinished sentence merges with the next page', () => {
  const { blocksOfItems, readerBlocksAcross } = load();
  // page 1 ends mid-sentence, page 2 continues it
  const p1 = blocksOfItems([its('The night was very dark and', 78, 800, 460, 11), its('the wind howled outside my window.', 78, 784, 460, 11)], 'Book');
  const p2 = blocksOfItems([its('She opened the door.', 78, 800, 460, 11), its('The room was empty.', 78, 784, 460, 11)], 'Book');
  // for a merge to trigger, the previous page trailing text must be unfinished
  const unfinished1 = blocksOfItems([its('The night was very dark and', 78, 800, 460, 11), its('she ran', 78, 784, 460, 11)], 'Book');
  const cont = blocksOfItems([its('and vanished into the fog.', 78, 800, 460, 11), its('Silence followed.', 78, 784, 460, 11)], 'Book');
  const r1 = readerBlocksAcross(null, unfinished1, cont);
  assert.equal(r1.length, 1);
  assert.equal(r1[0].text, 'The night was very dark and she ran and vanished into the fog.');
  // and the next page drops its leading paragraph that it already shared
  const r2 = readerBlocksAcross(unfinished1, cont, null);
  assert.equal(r2.length, 1);
  assert.equal(r2[0].text, 'Silence followed.');
});

test('finished sentence does not merge or drop', () => {
  const { blocksOfItems, readerBlocksAcross } = load();
  const p1 = blocksOfItems([its('She opened the door.', 78, 800, 460, 11), its('End of page.', 78, 784, 460, 11)], 'Book');
  const p2 = blocksOfItems([its('The room was empty.', 78, 800, 460, 11)], 'Book');
  const r1 = readerBlocksAcross(null, p1, p2);
  const r2 = readerBlocksAcross(p1, p2, null);
  assert.equal(r1.length, 1);
  assert.equal(r1[0].text, 'She opened the door. End of page.');
  assert.equal(r2.length, 1);
  assert.equal(r2[0].text, 'The room was empty.');
});

test('page numbers at the top and bottom are dropped, middle kept, roman numerals kept only as chapter', () => {
  const { blocksOfItems } = load();
  const items = [
    its('CHAPTER I', 78, 800, 460, 11),
    its('Some text here.', 78, 784, 460, 11),
    its('5', 296, 768, 4, 9),
    its('More text here.', 78, 752, 460, 11),
    its('6', 296, 736, 4, 9)
  ];
  const blocks = blocksOfItems(items, 'Book');
  const text = blocks.map(b => b.text).join(' ');
  assert.match(text, /CHAPTER I/);
  assert.match(text, /Some text here\./);
  assert.match(text, /More text here\./);
  // middle page number "5" must survive; bottom "6" and top "CHAPTER I" stays
  assert.match(text, /\b5\b/);
  assert.doesNotMatch(text, /\b6\b/);
});

test('roman-numeral page markers at the edges are dropped', () => {
  const { blocksOfItems } = load();
  const items = [
    its('IV', 296, 800, 16, 9),
    its('Only real content on this page.', 78, 784, 460, 11),
    its('IV', 296, 768, 16, 9)
  ];
  const blocks = blocksOfItems(items, 'Book');
  const text = blocks.map(b => b.text).join(' ');
  assert.equal(text.trim(), 'Only real content on this page.');
});

test('letter-spaced title items join with a single space based on x gap', () => {
  const { lineTextJoin } = load();
  const items = [
    its('B L O O M', 241, 606, 46, 10),
    its(' ', 288, 606, 8, 10),
    its('L I B R A R Y', 295, 606, 59, 10)
  ];
  assert.equal(lineTextJoin(items, 10), 'B L O O M L I B R A R Y');
  // items overlapping the previous one join without a space
  const tight = [its('AB', 100, 606, 20, 10), its('CDE', 113, 606, 26, 10)];
  assert.equal(lineTextJoin(tight, 10), 'ABCDE');
  // items starting at or after the previous one ends join with a space
  const wide = [its('AB', 100, 606, 20, 10), its('CDE', 121, 606, 26, 10)];
  assert.equal(lineTextJoin(wide, 10), 'AB CDE');
});

test('no text lost or duplicated across three pages worth of paragraphs', () => {
  const { readerBlocksAcross, blocksOfItems, readerSerialize } = load();
  const pages = [
    [its('She walked all night.', 78, 800, 460, 11), its('The moon was full and cold and', 78, 784, 460, 11)],
    [its('high in the sky. She never looked', 78, 800, 460, 11), its('back. She kept walking all the long night.', 78, 784, 460, 11)],
    [its('She finally arrived.', 78, 800, 460, 11)]
  ];
  const p0 = blocksOfItems(pages[0], 'Book');
  const p1 = blocksOfItems(pages[1], 'Book');
  const p2 = blocksOfItems(pages[2], 'Book');
  const s0 = readerBlocksAcross(null, p0, p1);
  const s1 = readerBlocksAcross(p0, p1, p2);
  const s2 = readerBlocksAcross(p1, p2, null);
  const plain = blocks => blocks.map(b => (b.tag === 'h3' ? 'H3 ' : '') + b.text).join(' ');
  const all = [plain(s0), plain(s1), plain(s2)].join(' ');
  const expected = pages.flatMap(p => p.map(i => i.str)).join(' ');
  const norm = s => s.replace(/\s+/g, ' ').replace(/[^\w\s.,;:!?'"-]/g, '').trim();
  assert.equal(norm(all), norm(expected));
});
