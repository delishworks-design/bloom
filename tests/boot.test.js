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

function boot(saved) {
  const store = saved || {};
  const sandbox = {
    J: (k, d) => (Object.prototype.hasOwnProperty.call(store, k) ? JSON.parse(store[k]) : d),
    key: u => 'bloom_d_' + u,
    blank: () => ({ p: {}, logs: {}, tasks: [], done: {}, meals: {}, plan: {}, journal: [] }),
    loadRev() {},
    applyTheme() {},
    restoreNav() { sandbox.__nav = true; },
    shell() { sandbox.__shell = true; },
    toast() {},
    setTimeout() {},
    sbInit: () => Promise.resolve(),
    sbUser: null,
    sbPull() {},
    user: '',
    D: null
  };
  vm.runInNewContext(extract(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), 'boot'), sandbox, { filename: 'boot.js' });
  return { boot: sandbox.localSessionBoot, sandbox };
}

test('offline boot refuses partner sessions', () => {
  const { boot: run } = boot({ 'bloom_d_a@b.c': '{"logs":{"2026-01-01":{}}}' });
  assert.equal(run('p:owner-id'), false);
});

test('offline boot refuses when there is no cached copy', () => {
  const { boot: run } = boot({});
  assert.equal(run('a@b.c'), false);
});

test('offline boot renders the saved copy for the signed-in email', () => {
  const saved = JSON.stringify({ logs: { '2026-01-01': { done: true } } });
  const { boot: run, sandbox } = boot({ 'bloom_d_a@b.c': saved });
  assert.equal(run('A@B.C'), true);
  assert.equal(sandbox.user, 'a@b.c');
  assert.deepEqual(Object.keys(sandbox.D.logs), ['2026-01-01']);
  assert.equal(sandbox.__nav, true);
  assert.equal(sandbox.__shell, true);
});
