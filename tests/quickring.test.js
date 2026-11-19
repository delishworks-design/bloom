const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

// Minimal DOM stub sufficient for openQuickRing / close / qaAct interplay
class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this._class = new Set();
    this.id = '';
    this.parentNode = null;
    this.attributes = {};
    this.innerHTMLValue = '';
    this.style = { setProperty(k, v) { this[k] = String(v); }, visibility: '' };
  }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener(t, fn) { const a = this.listeners[t]; if (a) this.listeners[t] = a.filter(f => f !== fn); }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  click() { if (typeof this.onclick === 'function') this.onclick({ type: 'click', target: this, preventDefault() {} }); (this.listeners.click || []).slice().forEach(fn => fn({ type: 'click', target: this, preventDefault() {} })); }
  pointerdown() { (this.listeners.pointerdown || []).slice().forEach(fn => fn({ type: 'pointerdown', target: this, preventDefault() {} })); }
  addEventListener_setAttribute() {}
  focus() {}
  remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; } }
  appendChild(el) { el.parentNode = this; this.children.push(el); return el; }
  set innerHTML(html) {
    this._html = html;
    this.children = [];
    this.dataset = {};
    const scrim = new El('div'); scrim._class.add('qaring-scrim'); scrim.setAttribute('class', 'qaring-scrim'); this.appendChild(scrim);
    const core = new El('button'); core.id = 'qrCore'; core.setAttribute('id', 'qrCore'); core._class.add('qaring-core'); core.setAttribute('class', 'qaring-core'); this.appendChild(core);
    const re = /data-qa="([^"]+)"/g; let m;
    while ((m = re.exec(html))) {
      const item = new El('button'); item._class.add('qaring-item'); item.dataset.qa = m[1]; item.setAttribute('data-qa', m[1]); this.appendChild(item);
    }
  }
  get innerHTML() { return this._html || ''; }
  get classList() {
    const self = this;
    return {
      add(...cs) { cs.forEach(c => self._class.add(c)); },
      remove(...cs) { cs.forEach(c => self._class.delete(c)); },
      contains(c) { return self._class.has(c); },
      toggle(c, f) { if (f === undefined) f = !self._class.has(c); if (f) self._class.add(c); else self._class.delete(c); return f; }
    };
  }
  querySelector(sel) {
    if (sel.startsWith('.')) { const cls = sel.slice(1); return this.children.find(c => c._class.has(cls)) || null; }
    if (sel.startsWith('#')) { const id = sel.slice(1); return this.children.find(c => c.id === id) || null; }
    return null;
  }
  querySelectorAll(sel) {
    if (sel === '[data-qa]') return this.children.filter(c => c.dataset.qa);
    return [];
  }
}

function makeDoc() {
  const body = new El('body');
  const listeners = {};
  const doc = {
    body,
    listeners,
    getElementById(id) {
      if (id === 'qaring') return (body.children.find(c => c.id === 'qaring')) || null;
      if (id === 'qrCore') return (body.children.flatMap(c => c.children).find(c => c.id === 'qrCore')) || null;
      return null;
    },
    createElement(tag) { return new El(tag); },
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener(t, fn) { const a = listeners[t]; if (a) listeners[t] = a.filter(f => f !== fn); }
  };
  return doc;
}

function makeFab() {
  return { style: { visibility: 'visible' }, getBoundingClientRect: () => ({ left: 10, top: 400, width: 58, height: 58 }), innerHTML: '<svg>FAB</svg>', addEventListener() {} };
}

function i18n() {
  const el = () => '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
  return { list: el, drop: el, meal: el, mood: el, check: el, glass: el };
}

const WAIT = 200;

async function openCloseHarness() {
  const ctx = load();
  ctx.innerWidth = 390; ctx.innerHeight = 844;
  ctx.requestAnimationFrame = fn => fn();
  ctx.matchMedia = () => ({ matches: false });
  ctx.window = { matchMedia: () => ({ matches: false }) };
  ctx.IC = i18n();
  ctx.D = { fabFlower: 'bloom', p: { done: true } };
  ctx.document = makeDoc();
  return ctx;
}

test('quick ring opens and exposes all six actions', async () => {
  const ctx = await openCloseHarness();
  const actions = [];
  const fab = makeFab();
  ctx.openQuickRing(fab, a => actions.push(a));
  const ring = ctx.document.getElementById('qaring');
  assert.ok(ring, 'ring was appended');
  assert.deepEqual(ring.children.filter(c => c.dataset.qa).map(c => c.dataset.qa).sort(), ['log', 'meal', 'mood', 'period', 'plan', 'water']);
});

test('scrim tap and core tap both close the ring and restore FAB visibility', async () => {
  const ctx = await openCloseHarness();
  for (const closer of ['scrim', 'core']) {
    const actions = [];
    const fab = makeFab();
    ctx.openQuickRing(fab, a => actions.push(a));
    const ring = ctx.document.getElementById('qaring');
    assert.equal(fab.style.visibility, 'hidden');
    await new Promise(r => setTimeout(r, WAIT)); // freshness guard
    if (closer === 'scrim') ring.querySelector('.qaring-scrim').pointerdown();
    else ring.querySelector('#qrCore').click();
    assert.equal(ring.classList.contains('on'), false);
    await new Promise(r => setTimeout(r, 220)); // allow QA_TRANS_MS fallback to finish
    assert.equal(ctx.document.getElementById('qaring'), null, 'overlay removed from the DOM');
    assert.equal(fab.style.visibility, '');
    assert.equal(actions.length, 0, 'plain close does not invoke an action');
  }
});

test('escape closes the ring', async () => {
  const ctx = await openCloseHarness();
  const actions = [];
  const fab = makeFab();
  ctx.openQuickRing(fab, a => actions.push(a));
  await new Promise(r => setTimeout(r, WAIT));
  ctx.document.listeners.keydown.forEach(fn => fn({ key: 'Escape' }));
  const ring = ctx.document.getElementById('qaring');
  assert.equal(ring && ring.classList.contains('on'), false);
  await new Promise(r => setTimeout(r, 220));
  assert.equal(ctx.document.getElementById('qaring'), null);
  assert.equal(fab.style.visibility, '');
});

test('action fires exactly once even with repeated clicks', async () => {
  const ctx = await openCloseHarness();
  const actions = [];
  const fab = makeFab();
  ctx.openQuickRing(fab, a => actions.push(a));
  const ring = ctx.document.getElementById('qaring');
  await new Promise(r => setTimeout(r, WAIT));
  const item = ring.children.find(c => c.dataset.qa === 'mood');
  item.click();
  item.click();
  item.click();
  assert.deepEqual(actions, ['mood']);
});

test('rapid close then reopen never swallows a fresh ring', async () => {
  const ctx = await openCloseHarness();
  const actions = [];
  const fab = makeFab();
  ctx.openQuickRing(fab, a => actions.push(a));
  const first = ctx.document.getElementById('qaring');
  await new Promise(r => setTimeout(r, WAIT));
  first.querySelector('.qaring-scrim').pointerdown(); // begin closing
  const secondFab = makeFab();
  ctx.openQuickRing(secondFab, a => actions.push(a)); // reopen before the old one removed itself
  const second = ctx.document.getElementById('qaring');
  assert.ok(second, 'a fresh ring exists');
  assert.notEqual(second, first);
  await new Promise(r => setTimeout(r, WAIT));
  assert.ok(second.children.find(c => c.dataset.qa === 'meal'));
  second.children.find(c => c.dataset.qa === 'meal').click();
  assert.deepEqual(actions, ['meal']);
});

test('second close does not drop the fresh ring due to a stale cleanup', async () => {
  const ctx = await openCloseHarness();
  const actions = [];
  const fab = makeFab();
  ctx.openQuickRing(fab, a => actions.push(a));
  await new Promise(r => setTimeout(r, WAIT));
  ctx.document.getElementById('qaring').querySelector('.qaring-scrim').click();
  const reopened = makeFab();
  ctx.openQuickRing(reopened, a => actions.push(a));
  const fresh = ctx.document.getElementById('qaring');
  // wait past the stale overlay's fallback window
  await new Promise(r => setTimeout(r, 260));
  assert.equal(ctx.document.getElementById('qaring'), fresh, 'the reopened ring is not removed by a stale close');
});

test('normal close restores FAB visibility and removes the ring', async () => {
  const ctx = await openCloseHarness();
  const fab = makeFab();
  ctx.openQuickRing(fab, a => {});
  assert.equal(fab.style.visibility, 'hidden');
  const ring = ctx.document.getElementById('qaring');
  await new Promise(r => setTimeout(r, WAIT));
  ring.querySelector('#qrCore').click();
  await new Promise(r => setTimeout(r, 260));
  assert.equal(ctx.document.getElementById('qaring'), null);
  assert.equal(fab.style.visibility, '');
});

test('stale removal unregisters the old ring Escape listener', async () => {
  const ctx = await openCloseHarness();
  const fab = makeFab();
  ctx.openQuickRing(fab, a => {});
  const ring = ctx.document.getElementById('qaring');
  assert.equal(ctx.document.listeners.keydown.length, 1);
  ctx.openQuickRing(makeFab(), a => {}); // drops the stale ring and registers a fresh Escape listener
  assert.equal(ctx.document.listeners.keydown.length, 1, 'fresh ring has its own single Escape listener');
  await new Promise(r => setTimeout(r, WAIT)); // fresh() guard on the new ring
  ctx.document.listeners.keydown.forEach(fn => fn({ key: 'Escape' }));
  await new Promise(r => setTimeout(r, 260)); // allow QA_TRANS_MS fallback to run
  assert.equal(ctx.document.getElementById('qaring'), null, 'Escape closed the active ring');
});

test('old cleanup cannot restore FAB visibility while a new ring is open', async () => {
  const ctx = await openCloseHarness();
  const actions = [];
  const fab1 = makeFab();
  ctx.openQuickRing(fab1, a => actions.push(a));
  await new Promise(r => setTimeout(r, WAIT));
  ctx.document.getElementById('qaring').querySelector('#qrCore').click(); // begin close of ring1
  const fab2 = makeFab();
  ctx.openQuickRing(fab2, a => actions.push(a)); // open ring2 before ring1 cleanup ran
  assert.equal(fab2.style.visibility, 'hidden');
  // let ring1's cleanup timer fire
  await new Promise(r => setTimeout(r, 300));
  assert.equal(fab2.style.visibility, 'hidden', 'ring2 owns the FAB; ring1 must not un-hide it');
  assert.ok(ctx.document.getElementById('qaring'), 'ring2 is still in the DOM');
});

test('old cleanup cannot remove a newly opened ring', async () => {
  const ctx = await openCloseHarness();
  const fab1 = makeFab();
  ctx.openQuickRing(fab1, a => {});
  await new Promise(r => setTimeout(r, WAIT));
  ctx.document.getElementById('qaring').querySelector('#qrCore').click(); // close ring1
  const fab2 = makeFab();
  ctx.openQuickRing(fab2, a => {}); // reopen
  const fresh = ctx.document.getElementById('qaring');
  await new Promise(r => setTimeout(r, 300)); // wait past ring1's cleanup window
  assert.equal(ctx.document.getElementById('qaring'), fresh, 'new ring survives the old cleanup');
});

test('repeated cleanup is harmless', async () => {
  const ctx = await openCloseHarness();
  const fab = makeFab();
  ctx.openQuickRing(fab, a => {});
  const ring = ctx.document.getElementById('qaring');
  assert.equal(typeof ring._qaringCleanup, 'function');
  ring._qaringCleanup();
  ring._qaringCleanup();
  ring._qaringCleanup();
  assert.equal(ctx.document.getElementById('qaring'), null);
  assert.equal(fab.style.visibility, '');
});

test('first taps are honored immediately (no artificial lockout)', async () => {
  const ctx = await openCloseHarness();
  const actions = [];
  const fab = makeFab();
  ctx.openQuickRing(fab, a => actions.push(a));
  const ring = ctx.document.getElementById('qaring');
  const mood = ring.children.find(c => c.dataset.qa === 'mood');
  mood.click(); // no waiting: fire right away
  assert.deepEqual(actions, ['mood']);
});

test('outside click dismisses immediately and repeated opening works', async () => {
  const ctx = await openCloseHarness();
  const fab = makeFab();
  ctx.openQuickRing(fab, a => {});
  const first = ctx.document.getElementById('qaring');
  first.querySelector('.qaring-scrim').pointerdown(); // no waiting
  assert.equal(first.classList.contains('on'), false);
  ctx.openQuickRing(makeFab(), a => {});
  const second = ctx.document.getElementById('qaring');
  assert.ok(second);
  assert.notEqual(first, second);
});

test('quick ring opens with shared SVG artwork and six transparent interaction buttons', async () => {
  const ctx = await openCloseHarness();
  const fab = makeFab();
  ctx.openQuickRing(fab, a => {});
  const html = ctx.document.getElementById('qaring').innerHTML;
  assert.ok(html.includes('qaring-art'), 'shared artwork layer present');
  assert.ok(html.includes('id="qaringPet"'), 'single PET definition via defs/use');
  const useCount = (html.match(/<use /g) || []).length;
  assert.equal(useCount, 12, 'six petals two layers each');
  assert.equal((html.match(/class="qaring-item"/g) || []).length, 6, 'six accessible action buttons');
});
