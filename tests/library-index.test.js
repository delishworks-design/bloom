const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

function makeCatalog(n) { const books = []; for (let i = 0; i < n; i++) books.push({ id: 'bk' + i, title: 'Title ' + i, author: 'Author ' + (i % 131), category: ['Health', 'Pain', 'PCOS/PMOS'][i % 3], pages: 60 + i }); return { books }; }
function makePersonal(n, favs, finished) { const books = {}; for (let i = 0; i < n; i++) books['bk' + i] = { page: 1, pct: 0, finished: i < finished, favorite: i < favs, lastRead: 0, hl: [] }; return { books }; }

test('catalog index contains all 5,000 books and supports direct ID lookup', () => {
  const ctx = load();
  ctx.ST.set('bloom_library', JSON.stringify(makeCatalog(5000)));
  const idx = ctx.libIndexEnsure();
  assert.equal(idx.byId.size, 5000);
  for (const i of [0, 1, 999, 2500, 4999]) {
    assert.equal(idx.byId.get('bk' + i).id, 'bk' + i);
    assert.equal(idx.byId.get('bk' + i).title, 'Title ' + i);
  }
});

test('catalog index is reused (not rebuilt) while the catalog is unchanged', () => {
  const ctx = load();
  ctx.ST.set('bloom_library', JSON.stringify(makeCatalog(200)));
  const a = ctx.libIndexEnsure();
  const b = ctx.libIndexEnsure();
  assert.equal(a, b);
});

test('personal-library index counts favorites / reading / finished for 5,000 books', () => {
  const ctx = load();
  ctx.ST.set('bloom_library', JSON.stringify(makeCatalog(5000)));
  ctx.D = { library: { books: makePersonal(5000, 40, 120).books } };
  const pi = ctx.libPersonalIndex();
  assert.equal(pi.all.length, 5000);
  assert.equal(pi.favs.length, 40);
  assert.equal(pi.fin.length, 120);
  assert.equal(pi.reading.length, 5000 - 120);
});

test('personal-library index is invalidated by mutation and rebuilt correctly', () => {
  const ctx = load();
  ctx.ST.set('bloom_library', JSON.stringify(makeCatalog(500)));
  const books = makePersonal(100, 10, 10).books;
  ctx.D = { library: { books } };
  assert.equal(ctx.libPersonalIndex().fin.length, 10);
  books.bk50.finished = true; books.bk50.favorite = true; // bk50 was neither
  ctx.libPersonalInvalidate();
  const after = ctx.libPersonalIndex();
  assert.equal(after.fin.length, 11);
  assert.equal(after.favs.length, 11);
});

test('batch plan returns the first 40 and a done flag at the end', () => {
  const ctx = load();
  const p1 = ctx.libViewPlan(5000, 0);
  assert.equal(p1.start, 0); assert.equal(p1.end, 40); assert.equal(p1.done, false);
  const p2 = ctx.libViewPlan(5000, 40);
  assert.equal(p2.start, 40); assert.equal(p2.end, 80); assert.equal(p2.done, false);
  const p3 = ctx.libViewPlan(5000, 4960);
  assert.equal(p3.start, 4960); assert.equal(p3.end, 5000); assert.equal(p3.done, true);
  const p4 = ctx.libViewPlan(10, 0);
  assert.equal(p4.start, 0); assert.equal(p4.end, 10); assert.equal(p4.done, true);
});

test('first batch returns exactly 40 unique ids of a 5,000-book library', () => {
  const ctx = load();
  const ids = Array.from({ length: 5000 }, (_, i) => 'bk' + i);
  ctx.libViewSet(ids);
  const first = ctx.libBatchIds(0, 40);
  assert.equal(first.length, 40);
  assert.equal(new Set(first).size, 40);
  assert.equal(first[0], 'bk0');
  assert.equal(first[39], 'bk39');
});

test('loading a second batch yields the next 40 unique ids, no overlap with the first', () => {
  const ctx = load();
  const ids = Array.from({ length: 5000 }, (_, i) => 'bk' + i);
  ctx.libViewSet(ids);
  const first = ctx.libBatchIds(0, 40);
  const second = ctx.libBatchIds(40, 80);
  assert.equal(second.length, 40);
  assert.equal(new Set([...first, ...second]).size, 80);
  assert.equal(second[0], 'bk40');
});

test('indexes come from existing data only, adding or removing a book invalidates', () => {
  const ctx = load();
  ctx.ST.set('bloom_library', JSON.stringify(makeCatalog(50)));
  const books = makePersonal(10, 2, 2).books;
  ctx.D = { library: { books } };
  assert.equal(ctx.libPersonalIndex().all.length, 10);
  delete ctx.D.library.books.bk0;
  ctx.libPersonalInvalidate();
  assert.equal(ctx.libPersonalIndex().all.length, 9);
});

test('document-specific calls never reuse a different document cached index', () => {
  const ctx = load();
  const docA = { library: { books: { a1: { page: 1, finished: true, favorite: false, lastRead: 0, hl: [] } } } };
  const docB = { library: { books: { b1: { page: 1, finished: false, favorite: true, lastRead: 0, hl: [] }, b2: { page: 1, finished: false, favorite: false, lastRead: 0, hl: [] } } } };
  const a = ctx.libPersonalIndex(docA);
  assert.equal(a.all.length, 1);
  assert.equal(a.fin.length, 1);
  const b = ctx.libPersonalIndex(docB); // different doc must not be served from docA's cache
  assert.equal(b.all.length, 2);
  assert.equal(b.favs.length, 1);
  const aAgain = ctx.libPersonalIndex(docA);
  assert.equal(aAgain.all.length, 1);
  assert.equal(aAgain.fin.length, 1);
});

test('same books object reused twice returns the cached index without rebuild', () => {
  const ctx = load();
  const books = { a1: { page: 1, finished: false, favorite: false, lastRead: 0, hl: [] } };
  const doc = { library: { books } };
  const first = ctx.libPersonalIndex(doc);
  const second = ctx.libPersonalIndex(doc);
  assert.equal(first, second);
});

test('search-driven chip counts use the search-filtered scope', () => {
  const ctx = load();
  ctx.ST.set('bloom_library', JSON.stringify({ books: [{ id: 'keep1', title: 'Keep Me', author: 'A', category: 'Health', pages: 10 }, { id: 'other1', title: 'Other Book', author: 'B', category: 'Health', pages: 10 }] }));
  ctx.D = { library: { books: { keep1: { page: 1, finished: true, favorite: true, lastRead: 100, hl: [] }, other1: { page: 1, finished: false, favorite: false, lastRead: 0, hl: [] } } } };
  ctx.libPersonalInvalidate();
  // exercise the real chip-count helper on the search-filtered scope
  const personal = ctx.libPersonalIndex();
  const fAll = ['keep1']; // "keep" matches only keep1
  const counts = ctx.libChipCounts(fAll, ctx.D.library.books, personal, 'keep');
  assert.equal(counts.nAll, 1);
  assert.equal(counts.nFav, 1);
  assert.equal(counts.nFin, 1);
  assert.equal(counts.nRead, 0);
  // no-search view must fall back to unfiltered personal totals
  const countsAll = ctx.libChipCounts(['keep1', 'other1'], ctx.D.library.books, personal, '');
  assert.equal(countsAll.nAll, 2);
  assert.equal(countsAll.nFin, 1);
  assert.equal(countsAll.nFav, 1);
  assert.equal(countsAll.nRead, 1);
});
