const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

function fresh() {
  const ctx = load();
  // partner context
  ctx.RO = true; ctx.ROcloud = true; ctx.roHash = ''; ctx.ROowner = 'owner-uuid';
  ctx.sbUser = { id: 'partner-uuid', email: 'p@x.com' };
  ctx.user = 'p@x.com';
  return ctx;
}

test('libStoreKey for partner uses own uid not owner', () => {
  const ctx = fresh();
  assert.equal(ctx.libStoreKey(), 'bloom_reader_partner_partner-uuid');
  ctx.ROowner = 'different-owner';
  assert.equal(ctx.libStoreKey(), 'bloom_reader_partner_partner-uuid');
});

test('libStoreKey varies across signed-in partner accounts', () => {
  const ctx = fresh();
  ctx.sbUser = { id: 'partner-1' };
  const k1 = ctx.libStoreKey();
  ctx.sbUser = { id: 'partner-2' };
  const k2 = ctx.libStoreKey();
  assert.notEqual(k1, k2);
});

test('libMergeDocs keeps books from both sides and wins by lastRead/page', () => {
  const ctx = fresh();
  const local = { books: { a: { page: 1, pct: 10, lastRead: 100, finished: false, favorite: false, hl: [] } } };
  const remote = { books: { b: { page: 99, pct: 90, lastRead: 200 }, a: { page: 50, pct: 50, lastRead: 150, favorite: true, finished: true } } };
  const merged = ctx.libMergeDocs(local, remote);
  assert.equal(merged.books.b.page, 99);
  assert.equal(merged.books.a.page, 50);
  assert.equal(merged.books.a.finished, true);
  assert.equal(merged.books.a.favorite, true);
  assert.equal(merged.books.b.page, 99);
});

test('libMergeDocs does not drop local when cloud is empty object', () => {
  const ctx = fresh();
  const local = { books: { onlyLocal: { page: 7, lastRead: 10 } } };
  const merged = ctx.libMergeDocs(local, {});
  assert.equal(merged.books.onlyLocal.page, 7);
});

test('libMergeDocs handles malformed inputs gracefully', () => {
  const ctx = fresh();
  const merged = ctx.libMergeDocs(null, undefined);
  assert.equal(Object.keys(merged.books).length, 0);
});

test('libStoreWrite dispatches cloud write only for partner mode with sbUser', () => {
  const ctx = fresh();
  let pushed = 0;
  ctx.partnerLibPush = function(){ pushed++; return Promise.resolve('ok'); };
  ctx.RO = false; ctx.ROowner = null; ctx.sbUser = { id: 'acc-1' }; ctx.user = 'me@me.com';
  ctx.libStoreWrite({ books: {} });
  assert.equal(pushed, 0); // normal account stays off the partner bucket
  ctx.RO = true; ctx.ROowner = 'owner-x'; ctx.sbUser = { id: 'p-2' }; ctx.user = 'me@me.com';
  ctx.libStoreWrite({ books: {} });
  assert.equal(pushed, 1);
});

test('a newer unfavorite beats a stale favorite', () => {
  const ctx = fresh();
  const local = { books: { a: { page: 1, favorite: false, favAt: 200 } } };
  const remote = { books: { a: { page: 1, favorite: true, favAt: 100 } } };
  const merged = ctx.libMergeDocs(local, remote);
  assert.equal(merged.books.a.favorite, false);
});

test('a newer mark-unfinished beats a stale finished flag', () => {
  const ctx = fresh();
  const local = { books: { a: { page: 80, pct: 100, finished: false, finAt: 300 } } };
  const remote = { books: { a: { page: 80, pct: 100, finished: true, finAt: 100 } } };
  const merged = ctx.libMergeDocs(local, remote);
  assert.equal(merged.books.a.finished, false);
});

test('a deleted book does not reappear from a stale snapshot', () => {
  const ctx = fresh();
  const local = { books: {}, _del: { books: { gone: { t: 400 } } } };
  const remote = { books: { gone: { page: 1, pct: 0, lastRead: 0, favorite: false, finished: false } } };
  const merged = ctx.libMergeDocs(local, remote);
  assert.equal(merged.books.gone, undefined);
});

test('a deleted book survives even when the stale copy looks newer by page', () => {
  const ctx = fresh();
  const local = { books: {}, _del: { books: { gone: { t: 5000 } } } };
  const remote = { books: { gone: { page: 9, pct: 40, lastRead: 100, favorite: false, finished: false } } };
  const merged = ctx.libMergeDocs(local, remote);
  assert.equal(merged.books.gone, undefined);
});

test('an edit after the tombstone keeps the book', () => {
  const ctx = fresh();
  const local = { books: { keep: { page: 9, pct: 40, lastRead: 9000, favorite: false } }, _del: { books: { keep: { t: 5000 } } } };
  const remote = { books: {} };
  const merged = ctx.libMergeDocs(local, remote);
  assert.equal(merged.books.keep.page, 9);
});

test('highlights from both devices are retained by their stable ids', () => {
  const ctx = fresh();
  const local = { books: { a: { page: 1, hl: [{ id: 'h1', start: 1, end: 9, text: 'x', color: '#FFD966', at: 10 }] } } };
  const remote = { books: { a: { page: 1, hl: [{ id: 'h2', start: 20, end: 30, text: 'y', color: '#FFD966', at: 20 }] } } };
  const merged = ctx.libMergeDocs(local, remote);
  assert.deepEqual(Array.from(merged.books.a.hl, h => h.id).sort(), ['h1', 'h2']);
});

test('a deleted highlight does not reappear from a stale snapshot', () => {
  const ctx = fresh();
  const local = { books: { a: { page: 1, hl: [] } }, _del: { hl: { a: { h1: { t: 500 } } } } };
  const remote = { books: { a: { page: 1, hl: [{ id: 'h1', start: 1, end: 9, text: 'x', at: 100 }] } } };
  const merged = ctx.libMergeDocs(local, remote);
  assert.equal(merged.books.a.hl.length, 0);
});

test('a downloaded-file flag from another device is not adopted', () => {
  const ctx = fresh();
  const remote = { books: { a: { page: 1, dl: true, lastRead: 0 } } };
  const merged = ctx.libMergeDocs({ books: {} }, remote);
  assert.equal(merged.books.a.dl, false);
});
