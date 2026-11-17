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
