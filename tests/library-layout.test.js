const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const books = [
  { id:'a', category:'PCOS/PMOS', title:'A' },
  { id:'b', category:'PCOS/PMOS', title:'B' },
  { id:'c', category:'Health', title:'C' },
  { id:'d', category:'Classic', title:'D' }
];

test('exploreGroups groups by category and defaults Other for missing', () => {
  const { exploreGroups, exploreDefaultCategory } = load();
  const groups = exploreGroups(books.concat([{id:'e'}]));
  assert.equal(groups.get('PCOS/PMOS').length, 2);
  assert.equal(groups.get('Other').length, 1);
  assert.equal(exploreDefaultCategory(groups), 'PCOS/PMOS');
});

test('exploreDefaultCategory picks largest group when PCOS/PMOS absent', () => {
  const { exploreGroups, exploreDefaultCategory } = load();
  const groups = exploreGroups([{id:'x',category:'Health'},{id:'y',category:'Health'},{id:'z',category:'Classic'}]);
  assert.equal(exploreDefaultCategory(groups), 'Health');
});

test('exploreDefaultCategory returns null when empty', () => {
  const { exploreGroups, exploreDefaultCategory } = load();
  assert.equal(exploreDefaultCategory(exploreGroups([])), null);
});

test('exploreBooks returns only selected category, or all for "all"', () => {
  const { exploreBooks } = load();
  assert.equal(exploreBooks(books, 'PCOS/PMOS').length, 2);
  assert.equal(exploreBooks(books, 'Classic').length, 1);
  assert.equal(exploreBooks(books, 'all').length, 4);
});

test('exploreBooks falls back to default category for unknown selection', () => {
  const { exploreBooks } = load();
  assert.equal(exploreBooks(books, 'Unknown').length, 2);
});

test('exploreOrder puts health categories first', () => {
  const { exploreGroups, exploreOrder } = load();
  const order = exploreOrder(exploreGroups(books));
  assert.equal(order[0], 'PCOS/PMOS');
  assert.equal(order[1], 'Health');
});

test('browse renders one grid via single category chips (no seeall/stacked sections in explore)', () => {
  const fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html, /data-expcat/);
  assert.match(html, /class="lib-expchips"/);
  // explore-by-genre (My Library) stays single-grid — seeall only exists in the Bloom Store panel
  const m = html.match(/function exploreByGenreHTML[\s\S]*?\n}/);
  assert.ok(m, 'exploreByGenreHTML found');
  assert.doesNotMatch(m[0], /data-seeall/);
});
