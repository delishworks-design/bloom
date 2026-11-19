const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./load');

function catalog(prefix, n) { const books = []; for (let i = 0; i < n; i++) books.push({ id: prefix + i, title: 'T' + i, author: 'A' + i, category: i % 2 ? 'Health' : 'Pain' }); return { books }; }

test('libCached parses the stored catalog once and reuses memory', () => {
  const ctx = load();
  ctx.ST.set('bloom_library', JSON.stringify(catalog('mem', 3)));
  const first = ctx.libCached();
  ctx.ST.set('bloom_library', JSON.stringify(catalog('repl', 7)));
  const second = ctx.libCached();
  assert.equal(first, second); // memory wins over storage until invalidated
  assert.equal(second.length, 3);
});

test('refreshLibrary replaces the catalog and invalidates memory on change', async () => {
  const ctx = load();
  ctx.view = 'cycle';
  ctx.ST.set('bloom_library', JSON.stringify(catalog('old', 2)));
  const before = ctx.libCached();
  const fresh = catalog('new', 5);
  ctx.fetch = async () => ({ ok: true, status: 200, headers: { get: () => 'EtagV2' }, json: async () => fresh });
  ctx.safeToRender = () => false;
  await ctx.refreshLibrary();
  const after = ctx.libCached();
  assert.notEqual(after, before);
  assert.equal(after[0].id, 'new0');
  assert.equal(ctx.ST.get('bloom_lib_etag'), 'EtagV2');
  assert.equal(ctx.libSearchText(after[0]), 't0 a0 pain');
});

test('malformed catalog data does not replace the valid cached one', async () => {
  const ctx = load();
  ctx.view = 'cycle';
  ctx.ST.set('bloom_library', JSON.stringify(catalog('ok', 4)));
  ctx.fetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ books: [] }) });
  ctx.safeToRender = () => false;
  await ctx.refreshLibrary();
  assert.equal(ctx.libCached().length, 4);
  assert.equal(ctx.libCached()[0].id, 'ok0');
});

test('a 304 response keeps the existing catalog and does not fetch the body', async () => {
  const ctx = load();
  ctx.view = 'cycle';
  ctx.ST.set('bloom_library', JSON.stringify(catalog('keep', 3)));
  ctx.ST.set('bloom_lib_etag', 'EtagV1');
  ctx.ST.set('bloom_lib_fetched_at', String(Date.now() - 13 * 3600 * 1000));
  const before = ctx.libCached();
  let sentIfNoneMatch = null;
  ctx.fetch = async (url, opts) => { sentIfNoneMatch = opts && opts.headers && opts.headers['If-None-Match']; return { ok: true, status: 304, headers: { get: () => null }, json: async () => { throw new Error('body must not be read'); } }; };
  await ctx.refreshLibrary();
  assert.equal(sentIfNoneMatch, 'EtagV1');
  assert.equal(ctx.libCached(), before);
});

test('libDebounce calls once with the latest value inside the window', async () => {
  const ctx = load();
  const calls = [];
  const fn = ctx.libDebounce(v => calls.push(v), 180);
  fn('sl'); fn('sle'); fn('sleep');
  await new Promise(r => setTimeout(r, 260));
  assert.deepEqual(calls, ['sleep']);
});

test('libSearchText caches per book id', () => {
  const ctx = load();
  const b = { id: 'x1', title: 'Some Book', author: 'Au', category: 'Pain' };
  const t1 = ctx.libSearchText(b);
  b.title = 'MUTATED TITLE';
  assert.equal(ctx.libSearchText(b), t1);
  assert.equal(t1, 'some book au pain');
});

test('applyLibFilter favorites / reading / finished / all remain correct', () => {
  const ctx = load();
  const L = { books: { a: { favorite: true, finished: false }, b: { favorite: true, finished: true }, c: { favorite: false, finished: false } } };
  const all = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  ctx.libFilter = 'all';      assert.deepEqual(ctx.applyLibFilter(all, L).map(b => b.id), ['a', 'b', 'c']);
  ctx.libFilter = 'favorites';assert.deepEqual(ctx.applyLibFilter(all, L).map(b => b.id), ['a', 'b']);
  ctx.libFilter = 'reading';  assert.deepEqual(ctx.applyLibFilter(all, L).map(b => b.id), ['a', 'c']);
  ctx.libFilter = 'finished'; assert.deepEqual(ctx.applyLibFilter(all, L).map(b => b.id), ['b']);
});

test('store rows, See all wiring and incremental sheet paging are intact in index.html', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const marker of ['data-seeall', 'showStoreSheet', 'storeFeatured', 'storeReco', 'storeNew', 'data-genre', 'storeMore']) {
    assert.ok(html.includes(marker), 'missing store wiring: ' + marker);
  }
});

test('localSessionBoot never adopts a partner session as an owner session', () => {
  const ctx = load();
  ctx.applyTheme = () => {}; ctx.restoreNav = () => true; ctx.shell = () => {}; ctx.startReconnectWatch = () => {}; ctx.loadRev = () => {};
  ctx.RO = false; ctx.ownMode = false; ctx.ownLoading = false; ctx.user = null;
  assert.equal(ctx.localSessionBoot('p:owner-uuid'), false);
  assert.equal(ctx.user, null);
});

test('localSessionBoot boots a cached owner session with offline data intact', () => {
  const ctx = load();
  ctx.applyTheme = () => {}; ctx.restoreNav = () => true; ctx.shell = () => {}; ctx.startReconnectWatch = () => {}; ctx.loadRev = () => {};
  ctx.RO = false; ctx.ownMode = false; ctx.ownLoading = false; ctx.user = null;
  const doc = { savedAt: 1, logs: { '2026-11-18': {} }, tasks: [], journal: [], meals: {}, plan: {}, p: {}, library: { books: {} }, read: { goalMin: 5, goalBooks: 1, log: {} } };
  ctx.ST.set('bloom_d_alice@example.com', JSON.stringify(doc));
  assert.equal(ctx.localSessionBoot('alice@example.com'), true);
  assert.equal(ctx.user, 'alice@example.com');
});

test('the 60s auto-refresh leaves the open Library view alone', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /if\(view==='library'\)return/);
});

test('sync flow and reading spans are untouched by this pass', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /function mergeDocsThreeWay\(/);
  assert.match(html, /function readingMerge\(/);
  assert.match(html, /function partnerLibRefresh\(/);
  assert.match(html, /setInterval\(syncTick,12000\)/);
});
