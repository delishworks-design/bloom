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

function makeEnv(awayMs) {
  const storage = {};
  if (awayMs != null) storage['bloom_last_bg'] = String(Date.now() - awayMs);
  const localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem(k, v) { storage[k] = String(v); },
    removeItem(k) { delete storage[k]; }
  };
  const splashEl = {
    classList: { contains: () => false, add() {}, remove() {} },
    style: { display: '', opacity: '' },
    onclick: null,
    querySelectorAll: () => [],
    appendChild() {}
  };
  const body = { classList: { contains: () => false, add() {}, remove() {} } };
  const document = {
    getElementById(id) { return id === 'splash' ? splashEl : null; },
    createElement() { return { id: '', style: { setProperty() {} }, innerHTML: '', animate() { return { cancel() {} }; } }; },
    body,
    insertAdjacentHTML() {},
    addEventListener() {}
  };
  const sandbox = {
    console,
    Date,
    JSON,
    Math,
    Map,
    Set,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    Promise,
    Intl,
    setTimeout(fn, ms) { return 0; },
    clearTimeout() {},
    innerWidth: 390,
    innerHeight: 844,
    localStorage,
    document,
    window: {},
    addEventListener() {}
  };
  sandbox.window = sandbox;
  return { sandbox, storage, splashEl };
}

test('splash hide is idempotent', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = extract(html, 'splash');
  const { sandbox, splashEl } = makeEnv(null);
  vm.runInNewContext(code, sandbox, { filename: 'splash.js' });
  sandbox.splashPlay();
  assert.equal(sandbox.splashDone, false);
  sandbox.splashHide();
  assert.equal(sandbox.splashDone, true);
  const displayAfterFirst = splashEl.style.display;
  sandbox.splashHide();
  assert.equal(sandbox.splashDone, true);
  assert.equal(splashEl.style.display, displayAfterFirst);
});

test('splash skip marks done without animation', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = extract(html, 'splash');
  const { sandbox, splashEl } = makeEnv(null);
  vm.runInNewContext(code, sandbox, { filename: 'splash.js' });
  sandbox.splashSkip();
  assert.equal(sandbox.splashDone, true);
  assert.equal(splashEl.style.display, 'none');
});

test('splash should show respects three-minute policy', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = extract(html, 'splash');
  const recent = makeEnv(60000);
  vm.runInNewContext(code, recent.sandbox, { filename: 'splash.js' });
  assert.equal(recent.sandbox.splashShouldShow(), false);

  const longAway = makeEnv(180000);
  vm.runInNewContext(code, longAway.sandbox, { filename: 'splash.js' });
  assert.equal(longAway.sandbox.splashShouldShow(), true);
});

test('resume does not trigger while splash is already playing', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = extract(html, 'splash');
  const { sandbox } = makeEnv(180000);
  vm.runInNewContext(code, sandbox, { filename: 'splash.js' });
  sandbox.splashPlay();
  assert.equal(sandbox.splashPlaying, true);
  const before = sandbox.splashT0;
  sandbox.__bloomResume(180000);
  assert.equal(sandbox.splashT0, before);
  assert.equal(sandbox.splashPlaying, true);
});

test('repeated splashPlay calls do not overlap after completion', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = extract(html, 'splash');
  const { sandbox } = makeEnv(null);
  vm.runInNewContext(code, sandbox, { filename: 'splash.js' });
  sandbox.splashPlay();
  sandbox.splashHide();
  assert.equal(sandbox.splashDone, true);
  const firstT0 = sandbox.splashT0;
  sandbox.splashPlay();
  assert.notEqual(sandbox.splashT0, firstT0);
  assert.equal(sandbox.splashDone, false);
});
