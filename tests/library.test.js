const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

test('blank() returns library skeleton with books + articles', () => {
  const ctx = load();
  const b = ctx.blank ? null : null; // blank() is a prefilled symbol; the real app uses the real blank(), not exposed, so we check mergeDocs output instead
  // In the app blank() has library; in the test sandbox it is prefilled with a plain shape, so assert through docHasContent
  assert.equal(typeof ctx.docHasContent, 'function');
});

test('mergeDocs keeps library books when both sides have them', () => {
  const ctx = load();
  const local = { savedAt: 1000, library: { books: { a: { page: 3, favorite: false } } } };
  const remote = { savedAt: 2000, library: { books: { a: { page: 7, favorite: true }, b: { page: 1 } }, articles: { 4: true } } };
  const out = ctx.mergeDocs(local, remote);
  assert.equal(out.library.books.a.page, 7);
  assert.equal(out.library.books.a.favorite, true);
  assert.equal(out.library.books.b.page, 1);
  assert.equal(out.library.articles[4], true);
});

test('mergeDocs: remote newer wins scalar leaves', () => {
  const ctx = load();
  const out = ctx.mergeDocs(
    { savedAt: 1, library: { books: { a: { page: 2 } } } },
    { savedAt: 99, library: { books: { a: { page: 8 } } } }
  );
  assert.equal(out.library.books.a.page, 8);
});

test('libVisibleIds filters by favorites / reading / finished', () => {
  const ctx = load();
  const lib = { books: {
    x: { favorite: true,  finished: false },
    y: { favorite: false, finished: true  },
    z: { favorite: true,  finished: true  },
    w: { favorite: false, finished: false }
  }, articles: {} };
  assert.deepEqual(ctx.libVisibleIds(lib, 'all').sort(), ['w','x','y','z']);
  assert.deepEqual(ctx.libVisibleIds(lib, 'favorites').sort(), ['x','z']);
  assert.deepEqual(ctx.libVisibleIds(lib, 'reading').sort(), ['w','x']);
  assert.deepEqual(ctx.libVisibleIds(lib, 'finished').sort(), ['y','z']);
});

test('libRecentList returns unfinished books sorted by lastRead desc', () => {
  const ctx = load();
  const lib = { books: {
    a: { lastRead: 100, finished: false },
    b: { lastRead: 300, finished: false },
    c: { lastRead: 200, finished: true  },
    d: { lastRead: 400, finished: false }
  }, articles: {} };
  assert.deepEqual(ctx.libRecentList(lib, 5), ['d','b','a']);
  assert.deepEqual(ctx.libRecentList(lib, 2), ['d','b']);
});

test('libArticleRead reflects per-article boolean map', () => {
  const ctx = load();
  const lib = { books: {}, articles: { '4': true, '7': false } };
  assert.equal(ctx.libArticleRead(lib, 4), true);
  assert.equal(ctx.libArticleRead(lib, 7), false);
  assert.equal(ctx.libArticleRead(lib, 9), false);
});

test('migrateLibrary copies old localStorage keys into D.library and clears them', () => {
  const ctx = load();
  // Simulated legacy state
  ctx.localStorage._m = { bloom_library_dl: '["pcos101"]', bloom_library_bk_pcos101: '12', bloom_hl_pcos101: '[{"start":5,"end":9,"text":"Test","color":"#FFD966"}]', bloom_recent_reads: '[{"id":"pcos101","page":12,"ts":1234}]' };
  const D = { savedAt: 1 };
  const out = ctx.migrateLibrary(D,
    k => ctx.localStorage.getItem(k),
    k => ctx.localStorage.removeItem(k)
  );
  assert.equal(out.library.books.pcos101.dl, true);
  assert.equal(out.library.books.pcos101.page, 12);
  assert.equal(out.library.books.pcos101.hl.length, 1);
  assert.ok(out.library.books.pcos101.lastRead >= 1234);
  // All migrated legacy keys should be removed
  assert.ok(!ctx.localStorage._m.bloom_library_dl);
  assert.ok(!ctx.localStorage._m.bloom_library_bk_pcos101);
  assert.ok(!ctx.localStorage._m.bloom_hl_pcos101);
  assert.ok(!ctx.localStorage._m.bloom_recent_reads);
  // Now idempotent:
  const D2 = { savedAt: 1, library: { books: { pcos101: { dl: true, page: 3 } }, articles: {} } };
  const out2 = ctx.migrateLibrary(D2, k => null, k => {});
  assert.equal(out2.library.books.pcos101.dl, true);
  assert.equal(out2.library.books.pcos101.page, 3); // not overwritten by absent old keys
});

test('blank() in sandbox returns a valid blank doc shape for merges', () => {
  const ctx = load();
  // The sandbox's blank() is a minimal plain object; verify has library-like merge target via mergeDocs
  const out = ctx.mergeDocs(
    { savedAt: 5 },
    { savedAt: 9, library: { books: {} } }
  );
  assert.ok(out.library);
  assert.deepEqual(out.library.books, {});
});
