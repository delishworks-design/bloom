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

test('a failed catalog fetch does not advance the successful-refresh timestamp', async () => {
  const ctx = load();
  const t0 = 1000;
  ctx.ST.set('bloom_lib_fetched_at', String(t0));
  ctx.fetch = async () => { throw new Error('network down'); };
  const r = await ctx.refreshLibrary();
  assert.equal(r, 'failed');
  assert.equal(ctx.ST.get('bloom_lib_fetched_at'), String(t0));
});

test('an invalid catalog response does not advance the successful-refresh timestamp', async () => {
  const ctx = load();
  const t0 = 1000;
  ctx.ST.set('bloom_lib_fetched_at', String(t0));
  ctx.fetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ books: [{ id: 123 }] }) });
  const r = await ctx.refreshLibrary();
  assert.equal(r, 'invalid');
  assert.equal(ctx.ST.get('bloom_lib_fetched_at'), String(t0));
});

test('a 304 response advances the successful-refresh timestamp', async () => {
  const ctx = load();
  const t0 = 1000;
  ctx.ST.set('bloom_lib_fetched_at', String(t0));
  ctx.ST.set('bloom_library', JSON.stringify(catalog('old', 2)));
  ctx.fetch = async () => ({ ok: true, status: 304, headers: { get: () => null } });
  const r = await ctx.refreshLibrary();
  assert.equal(r, 'fresh');
  assert.ok(Number(ctx.ST.get('bloom_lib_fetched_at')) > t0);
});

test('a valid catalog refresh advances the successful-refresh timestamp', async () => {
  const ctx = load();
  const t0 = 1000;
  ctx.view = 'cycle';
  ctx.ST.set('bloom_lib_fetched_at', String(t0));
  ctx.fetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => catalog('new', 3) });
  ctx.safeToRender = () => false;
  const r = await ctx.refreshLibrary();
  assert.equal(r, 'ok');
  assert.ok(Number(ctx.ST.get('bloom_lib_fetched_at')) > t0);
});

test('concurrent refreshes share a single download', async () => {
  const ctx = load();
  const t0 = 1000;
  let calls = 0;
  let release;
  ctx.fetch = () => {
    calls += 1;
    return new Promise(res => { release = () => res({ ok: true, status: 200, headers: { get: () => null }, json: async () => catalog('c', 3) }); });
  };
  ctx.view = 'cycle';
  ctx.safeToRender = () => false;
  ctx.ST.set('bloom_lib_fetched_at', String(t0));
  const p1 = ctx.refreshLibrary();
  const p2 = ctx.refreshLibrary();
  release();
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(calls, 1);
  assert.equal(r1, 'ok');
  assert.equal(r2, 'ok');
});

function fakeCard(bid) {
  const listeners = {};
  const n = {
    dataset: { bid, bound: undefined },
    listeners,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    setAttribute() {},
  };
  return n;
}

test('existing book cards are not bound twice after repeated Show more calls', () => {
  const ctx = load();
  const L = { books: { keep: { page: 1 } } };
  ctx.libEnsure = () => L;
  const scopeFactory = () => {
    const cards = [fakeCard('keep'), fakeCard('fresh')];
    return { cards, querySelectorAll: () => cards };
  };
  const scope = scopeFactory();
  ctx.bindStoreCards(scope);
  ctx.bindStoreCards(scope); // second Show more: same nodes, must be idempotent
  ctx.bindStoreCards(scope);
  for (const card of scope.cards) {
    assert.deepEqual(Object.keys(card.listeners).sort(), ['click', 'contextmenu', 'pointercancel', 'pointerdown', 'pointermove', 'pointerup']);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click', 'contextmenu']) {
      assert.equal(card.listeners[type].length, 1);
    }
  }
});

test('newly appended cards are fully interactive and long-press fires once', async () => {
  const ctx = load();
  ctx.D = null;
  const L = { books: { inside: { page: 1 } } }; // in library -> long-press menu allowed; outside -> no menu
  ctx.libEnsure = () => L;
  const fired = [];
  ctx.openBook = id => fired.push(['open', id]);
  ctx.showExploreSheet = id => fired.push(['explore', id]);
  ctx.showBookMenu = id => fired.push(['menu', id]);
  const cards = [fakeCard('inside'), fakeCard('fresh')];
  const scope = { querySelectorAll: () => cards, cards };
  ctx.bindStoreCards(scope);
  cards[0].listeners.click[0]();
  cards[1].listeners.click[0]();
  assert.deepEqual(fired, [['open', 'inside'], ['explore', 'fresh']]);
  // long press on an in-library book fires the menu once
  cards[0].listeners.pointerdown[0]({ changedTouches: [{ clientX: 10, clientY: 10 }] });
  await new Promise(r => setTimeout(r, 470));
  assert.deepEqual(fired, [ ['open', 'inside'], ['explore', 'fresh'], ['menu', 'inside'] ]);
});

test('a stalled fetch is aborted, does not advance the timestamp, and clears the in-flight lock', async () => {
  const ctx = load();
  ctx.AbortController = AbortController;
  ctx.libRefreshTimeoutSet(40);
  const t0 = 1000;
  ctx.ST.set('bloom_lib_fetched_at', String(t0));
  ctx.view = 'cycle';
  ctx.safeToRender = () => false;
  let sawSignal = null;
  ctx.fetch = (url, opts) => {
    sawSignal = opts && opts.signal;
    return new Promise((resolve, reject) => {
      if (sawSignal) sawSignal.addEventListener('abort', () => reject(new Error('aborted')));
      // never resolves on its own: simulates a hung network
    });
  };

  const r1 = await ctx.refreshLibrary();
  assert.equal(r1, 'failed');
  assert.ok(sawSignal && sawSignal.aborted === true, 'the request was aborted after the timeout');
  assert.equal(ctx.ST.get('bloom_lib_fetched_at'), String(t0)); // untouched
  assert.equal(ctx.ST.get('bloom_library'), null);              // stored catalog untouched

  // the in-flight lock cleared, so a later valid refresh can proceed
  ctx.fetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => catalog('retry', 2) });
  const r2 = await ctx.refreshLibrary();
  assert.equal(r2, 'ok');
  assert.ok(Number(ctx.ST.get('bloom_lib_fetched_at')) > t0);
});

test('the refresh timeout clears after a successful fetch so later calls are not pinned', async () => {
  const ctx = load();
  ctx.AbortController = AbortController;
  ctx.libRefreshTimeoutSet(40);
  ctx.view = 'cycle';
  ctx.safeToRender = () => false;
  ctx.ST.set('bloom_lib_fetched_at', '1000');
  ctx.fetch = async () => ({ ok: true, status: 304, headers: { get: () => null } });
  const r = await ctx.refreshLibrary();
  assert.equal(r, 'fresh');
  // a quick follow-up call is not blocked by a stale in-flight promise
  const again = await ctx.refreshLibrary();
  assert.equal(again, 'fresh');
});

test('Show more: first batch bound once, paging appends, old cards never double-bound, new cards work', () => {
  const ctx = load();
  const L = { books: {} };
  ctx.libEnsure = () => L;
  const fired = [];
  ctx.openBook = id => fired.push(['open', id]);
  ctx.showExploreSheet = id => fired.push(['explore', id]);
  ctx.showBookMenu = id => fired.push(['menu', id]);

  const firstBatch = [fakeCard('keep1'), fakeCard('keep2')];
  const scopeOf = nodes => ({ querySelectorAll: sel => (sel === '.bookcard[data-bid]' ? nodes : []), cards: nodes });
  const scope1 = scopeOf(firstBatch);
  ctx.bindStoreCards(scope1);

  const appended = [fakeCard('new1'), fakeCard('new2'), fakeCard('keep3')];
  const all = firstBatch.concat(appended);
  const scope2 = scopeOf(all); // Show more appends then re-scopes
  ctx.bindStoreCards(scope2);

  for (const card of all) {
    assert.equal(card.listeners.click.length, 1, `card ${card.dataset.bid} has exactly one click listener`);
    assert.equal(card.listeners.pointerdown.length, 1, `card ${card.dataset.bid} has exactly one pointerdown listener`);
    assert.equal(card.listeners.contextmenu.length, 1);
  }
  firstBatch[0].listeners.click[0]();
  firstBatch[1].listeners.click[0]();
  appended[0].listeners.click[0]();
  appended[1].listeners.click[0]();
  appended[2].listeners.click[0]();
  assert.deepEqual(fired, [
    ['explore', 'keep1'], ['explore', 'keep2'],
    ['explore', 'new1'], ['explore', 'new2'], ['explore', 'keep3'],
  ]);
});

test('timeout without AbortController still fails, clears the lock, and retry succeeds', async () => {
  const ctx = load();
  ctx.AbortController = undefined; // simulate environments without AbortController
  ctx.libRefreshTimeoutSet(40);
  const t0 = 1000;
  ctx.ST.set('bloom_lib_fetched_at', String(t0));
  ctx.view = 'cycle';
  ctx.safeToRender = () => false;
  ctx.fetch = () => new Promise(() => {}); // never settles

  const r1 = await ctx.refreshLibrary();
  assert.equal(r1, 'failed');
  assert.equal(ctx.ST.get('bloom_lib_fetched_at'), String(t0));

  ctx.fetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => catalog('after', 2) });
  const r2 = await ctx.refreshLibrary();
  assert.equal(r2, 'ok');
  assert.ok(Number(ctx.ST.get('bloom_lib_fetched_at')) > t0);
});

test('a fetch that resolves but whose response.json() hangs is also timed out', async () => {
  const ctx = load();
  ctx.AbortController = AbortController;
  ctx.libRefreshTimeoutSet(40);
  const t0 = 1000;
  ctx.ST.set('bloom_lib_fetched_at', String(t0));
  ctx.view = 'cycle';
  ctx.safeToRender = () => false;
  ctx.fetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: () => new Promise(() => {}) });

  const r1 = await ctx.refreshLibrary();
  assert.equal(r1, 'failed');
  assert.equal(ctx.ST.get('bloom_lib_fetched_at'), String(t0));
  assert.equal(ctx.ST.get('bloom_library'), null);

  ctx.fetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => catalog('ok', 2) });
  const r2 = await ctx.refreshLibrary();
  assert.equal(r2, 'ok');
});

test('successful and 304 attempts both clear the watchdog so immediate retries work', async () => {
  const ctx = load();
  ctx.AbortController = AbortController;
  ctx.libRefreshTimeoutSet(40);
  ctx.view = 'cycle';
  ctx.safeToRender = () => false;
  ctx.ST.set('bloom_lib_fetched_at', '1000');
  ctx.ST.set('bloom_library', JSON.stringify(catalog('304', 2)));
  ctx.fetch = async () => ({ ok: true, status: 304, headers: { get: () => null } });
  const r1 = await ctx.refreshLibrary();
  assert.equal(r1, 'fresh');
  const r2 = await ctx.refreshLibrary();
  assert.equal(r2, 'fresh'); // not pinned by a stale watchdog
});
