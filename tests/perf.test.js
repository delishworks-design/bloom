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

test('hasSafetyCopy: non-empty backup, missing backup, empty backup, and no JSON parsing', () => {
  const ctx = load();
  ctx.ST.set('bloom_backup_a@b.c', '{"not valid":"json either"');
  ctx.ST.set('bloom_backup_empty@b.c', '');
  ctx.JSON = Object.assign(Object.create(JSON), { parse() { throw new Error('settings must not parse'); } });
  assert.equal(ctx.hasSafetyCopy('a@b.c'), true);
  assert.equal(ctx.hasSafetyCopy('missing@b.c'), false);
  assert.equal(ctx.hasSafetyCopy('empty@b.c'), false);
  assert.equal(ctx.hasSafetyCopy(''), false);
});

test('restoreSafetyCopy rejects an invalid backup', () => {
  const ctx = load();
  ctx.user = 'a@b.c'; ctx.sbUser = null;
  ctx.D = { sentinel: true }; ctx.save = () => {}; ctx.shell = () => {}; ctx.blank = () => ({});
  const toasts = []; ctx.toast = m => toasts.push(m);
  ctx.ST.set('bloom_backup_a@b.c', '{"tasks":5}'); // not a valid Bloom backup
  const sheetHtmls = [];
  ctx.sheet = html => { sheetHtmls.push(html); };
  const handlers = {};
  ctx.$ = sel => ({ set onclick(fn) { handlers[sel] = fn; }, get onclick() { return handlers[sel]; } });
  ctx.restoreSafetyCopy();
  assert.equal(sheetHtmls.length, 1, 'settings offers restore for any non-empty backup');
  handlers['#rsGo'](); // user actually attempts the restore
  assert.deepEqual(ctx.D, { sentinel: true }); // data untouched
  assert.ok(toasts.length >= 1, 'an error or explanation is toasted');
  assert.match(String(toasts.join(' ')), /tasks/);
});

test('restoreSafetyCopy reports a corrupt backup without opening the restore UI', () => {
  const ctx = load();
  ctx.user = 'a@b.c'; ctx.sbUser = null;
  ctx.D = { sentinel: true }; ctx.save = () => {}; ctx.shell = () => {}; ctx.blank = () => ({});
  const toasts = []; ctx.toast = m => toasts.push(m);
  ctx.ST.set('bloom_backup_a@b.c', '{not json at all}');
  ctx.restoreSafetyCopy();
  assert.deepEqual(ctx.D, { sentinel: true });
  assert.ok(toasts.includes('No safety copy found'));
});

test('flower SVG is cached; different goals/stages generate; cache is capped; cached equals raw', () => {
  const ctx = load();
  const before = ctx.smartFlowerCacheSize();
  const a1 = ctx.smartFlowerSVG('Understand my cycle', 2);
  assert.equal(ctx.smartFlowerCacheSize(), before + 1);
  const a2 = ctx.smartFlowerSVG('Understand my cycle', 2);
  assert.equal(a2, a1);
  assert.equal(ctx.smartFlowerCacheSize(), before + 1); // no growth on hit
  assert.notEqual(ctx.smartFlowerSVG('Understand my cycle', 3), a1);
  assert.notEqual(ctx.smartFlowerSVG('Move more', 2), a1);
  for (let i = 0; i < 60; i++) ctx.smartFlowerSVG('Extra goal ' + i, 0);
  assert.ok(ctx.smartFlowerCacheSize() <= 40, 'cache never exceeds 40 entries');
  assert.equal(ctx.smartFlowerSVG('Understand my cycle', 2), ctx.smartFlowerSVGRaw('Understand my cycle', 2));
});

function safeTopFixture(initialHeight) {
  const h = { current: initialHeight };
  const reads = [];
  const creates = [];
  const listeners = {};
  const el = { style: {}, parentNode: null, remove() { this.parentNode = null; } };
  Object.defineProperty(el, 'offsetHeight', { get() { reads.push(h.current); return h.current; } });
  const ctx_window = { addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, visualViewport: { addEventListener(type, fn) { (listeners['vv:' + type] = listeners['vv:' + type] || []).push(fn); } } };
  const doc = { createElement(tag) { creates.push(tag); return el; }, body: { appendChild(el_) { el_.parentNode = {}; } } };
  return { h, reads, creates, listeners, el, win: ctx_window, doc };
}

test('safeTop measures once, caches, and reuses the cached height', () => {
  const ctx = load();
  const fx = safeTopFixture(34);
  ctx.document = fx.doc; ctx.window = fx.win;
  assert.equal(ctx.safeTop(), 34);
  assert.equal(fx.reads.length, 1);
  assert.equal(ctx.safeTop(), 34);
  assert.equal(ctx.safeTop(), 34);
  assert.equal(fx.reads.length, 1, 'no second layout read while cached');
});

test('safeTop falls back to 24px when the probe measures zero', () => {
  const ctx = load();
  const fx = safeTopFixture(0);
  ctx.document = fx.doc; ctx.window = fx.win;
  assert.equal(ctx.safeTop(), 24);
});

test('safeTop invalidates on resize, orientationchange and visualViewport.resize', () => {
  const ctx = load();
  const fx = safeTopFixture(34);
  ctx.document = fx.doc; ctx.window = fx.win;
  ctx.safeTop();
  ctx.safeTopBind();
  assert.equal(fx.reads.length, 1);
  fx.h.current = 60;
  fx.listeners['resize'][0]();
  assert.equal(ctx.safeTop(), 60);
  assert.equal(fx.reads.length, 2);
  fx.h.current = 72;
  fx.listeners['orientationchange'][0]();
  assert.equal(ctx.safeTop(), 72);
  fx.h.current = 80;
  fx.listeners['vv:resize'][0]();
  assert.equal(ctx.safeTop(), 80);
});

test('safeTop listeners are registered exactly once across calls', () => {
  const ctx = load();
  const fx = safeTopFixture(20);
  ctx.document = fx.doc; ctx.window = fx.win;
  ctx.safeTopBind(); ctx.safeTopBind(); ctx.safeTop(); ctx.safeTop();
  assert.equal(fx.listeners['resize'].length, 1);
  assert.equal(fx.listeners['orientationchange'].length, 1);
  assert.equal(fx.listeners['vv:resize'].length, 1);
});

test('safeTop never repeats DOM creation after the first call', () => {
  const ctx = load();
  const fx = safeTopFixture(45);
  ctx.document = fx.doc; ctx.window = fx.win;
  ctx.safeTop();
  ctx.safeTop();
  const createsBefore = fx.creates.length;
  ctx.safeTopInvalidate();
  ctx.safeTop();
  assert.equal(fx.creates.length, createsBefore, 'probe element is reused across re-measures');
});

test('settings rendering gate uses hasSafetyCopy and never JSON.parse()s the backup', () => {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const i = html.indexOf('function settingsPage()');
  assert.ok(i > 0);
  const end = html.indexOf('function', i + 10);
  const body = html.slice(i, end);
  assert.ok(body.includes('hasSafetyCopy(bkMail)'), 'settings gate calls hasSafetyCopy');
  assert.ok(!/JSON\.parse\(\s*ST\.get\(\s*'bloom_backup_/.test(body), 'settings must not parse the backup at render');
});

test('fabBounds keeps its original calculations', () => {
  const ctx = load();
  ctx.innerWidth = 600; ctx.innerHeight = 900;
  ctx.FAB_SZ = 58;
  ctx.safeTop = () => 24;
  const b = ctx.fabBounds();
  const W = Math.min(430, 600);
  const l0 = (600 - W) / 2;
  const r0 = l0 + W;
  assert.equal(b.l, l0 + 8);
  assert.equal(b.r, r0 - 58 - 8);
  assert.equal(b.t, 24 + 70);
  assert.equal(b.b, 900 - 88 - 58);
});

test('flower cache evicts the least recently used entry past 40', () => {
  const ctx = load();
  for (let i = 0; i < 40; i++) ctx.smartFlowerSVG('Fill goal ' + i, 0);
  assert.equal(ctx.smartFlowerCacheSize(), 40);
  // make Fill goal 0 recently used; Fill goal 1 is now the LRU
  ctx.smartFlowerSVG('Fill goal 0', 0);
  ctx.smartFlowerSVG('Fill goal 99', 0);
  assert.equal(ctx.smartFlowerCacheSize(), 40, 'cache never exceeds 40');
  const keys = [...ctx.SMART_FLOWER_CACHE.keys()];
  assert.ok(keys.includes('Fill goal 0|0'), 'recently accessed entry remains cached');
  assert.ok(!keys.includes('Fill goal 1|0'), 'least recently used entry was evicted');
  assert.ok(keys.includes('Fill goal 99|0'), 'new entry is cached');
});

test('quick ring timing is actually responsive', () => {
  const ctx = load();
  assert.ok(ctx.QA_TRANS_MS <= 250, 'overlay removal fallback is short');
  // the artificial freshness gate was removed from the interaction path entirely
  assert.equal(typeof ctx.qaFresh, 'undefined');
  assert.equal(typeof ctx.QA_FRESH_MS, 'undefined');
});

test('reduced-motion users get an effectively instant ring close', () => {
  const ctx = load();
  ctx.window = { matchMedia: () => ({ matches: true }) };
  assert.equal(ctx.qaPrefersReducedMotion(), true);
  ctx.window = { matchMedia: () => ({ matches: false }) };
  assert.equal(ctx.qaPrefersReducedMotion(), false);
  ctx.window = undefined;
  assert.equal(ctx.qaPrefersReducedMotion(), false);
});

test('index.html wires the quick ring to the new responsive timing constants', () => {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/const items=\[\['log','Log',IC\.list\],\['period','Period',IC\.drop\],\['meal','Meal',IC\.meal\],\['mood','Mood',IC\.mood\],\['plan','Plan',IC\.check\],\['water','Water',IC\.glass\]\]/);
  assert.ok(m, 'all six quick actions are still wired up in order');
  assert.ok(html.includes('openQuickRing'), 'openQuickRing still exists');
  assert.ok(html.includes('@media (prefers-reduced-motion: reduce){.qaring,.qaring .qaring-item,.qaring .qaring-core,.qaring-scrim'), 'reduced-motion ring CSS present');
  assert.ok(!html.includes(',520)}'), 'old 520ms close delay removed');
});

test('fab position can be placed anywhere in the viewport', () => {
  const ctx = load();
  ctx.innerWidth = 1440; ctx.innerHeight = 900; ctx.safeTop = () => 24;
  const p = ctx.fabClampXY(2000, 400, 58);
  assert.equal(p.x, 1440 - 58 - 8);
  assert.equal(p.y, 400);
  const q = ctx.fabClampXY(-50, -50, 58);
  assert.equal(q.x, 8);
  assert.equal(q.y, 32);
});

test('a corrupt saved fab position is ignored', () => {
  const ctx = load();
  ctx.localStorage.setItem('bloom_fab_xy', 'nope,nope');
  assert.equal(ctx.fabLoadXY(), null);
  ctx.localStorage.setItem('bloom_fab_xy', '200,300');
  assert.deepEqual({ x: ctx.fabLoadXY().x, y: ctx.fabLoadXY().y }, { x: 200, y: 300 });
});
