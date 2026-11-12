const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function extract(src, name) {
  const begin = '// @test-begin ' + name;
  const end = '// @test-end ' + name;
  const i = src.indexOf(begin);
  const j = src.indexOf(end, i + begin.length);
  if (i < 0 || j < 0) throw new Error('marker not found: ' + name);
  return src.slice(i + begin.length, j).trim();
}

function load(saved) {
  const store = saved == null ? {} : { bloom_nav: saved };
  const ST = {
    get(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    set(k, v) { store[k] = String(v); },
    del(k) { delete store[k]; }
  };
  const sandbox = {
    ST,
    RO: false,
    ownMode: false,
    view: 'cycle',
    tab: '',
    planPanel: 'mine',
    calM: '2026-01-01',
    requestAnimationFrame(fn) { fn(); },
    window: { scrollY: 0, __navScroll: null, addEventListener() {}, scrollTo() {} }
  };
  sandbox.window = sandbox.window;
  const code = extract(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), 'nav');
  vm.runInNewContext(code, sandbox, { filename: 'nav.js' });
  return { sandbox, store };
}

test('saveNav stores the current screen, tab and scroll', () => {
  const { sandbox, store } = load();
  sandbox.view = 'planner';
  sandbox.tab = 'meals';
  sandbox.planPanel = 'partner';
  sandbox.calM = '2026-02';
  sandbox.window.scrollY = 412.7;
  sandbox.saveNav();
  const saved = JSON.parse(store.bloom_nav);
  assert.equal(saved.view, 'planner');
  assert.equal(saved.tab, 'meals');
  assert.equal(saved.planPanel, 'partner');
  assert.equal(saved.calM, '2026-02');
  assert.equal(saved.scroll, 413);
});

test('restoreNav brings the last screen back and validates values', () => {
  const { sandbox } = load(JSON.stringify({ view: 'insights', tab: 'journal', planPanel: 'partner', calM: '2026-03', scroll: 250 }));
  assert.equal(sandbox.restoreNav(), true);
  assert.equal(sandbox.view, 'insights');
  assert.equal(sandbox.tab, 'journal');
  assert.equal(sandbox.planPanel, 'partner');
  assert.equal(sandbox.calM, '2026-03');
  assert.equal(sandbox.window.__navScroll, 250);
});

test('restoreNav falls back to cycle for stale or bad data', () => {
  const a = load(JSON.stringify({ view: 'deleted-screen', tab: 'nope', calM: 'x', scroll: -4 }));
  a.sandbox.restoreNav();
  assert.equal(a.sandbox.view, 'cycle');
  assert.equal(a.sandbox.tab, 'day');
  assert.equal(a.sandbox.calM, '2026-01-01');
  assert.equal(a.sandbox.window.__navScroll, 0);

  const b = load('not json');
  assert.equal(b.sandbox.restoreNav(), false);
  assert.equal(b.sandbox.view, 'cycle');
});

test('restoreNav leaves partner panel choice alone on a read-only device', () => {
  const { sandbox } = load(JSON.stringify({ view: 'planner', planPanel: 'mine' }));
  sandbox.RO = true;
  sandbox.planPanel = 'partner';
  sandbox.restoreNav();
  assert.equal(sandbox.planPanel, 'partner');
});
