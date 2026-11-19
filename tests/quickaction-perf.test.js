const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { load } = require('./load');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('still flower artwork carries no perpetual SMIL animation', () => {
  const ctx = load();
  const still = ctx.smartFlowerSVG('Move more', 4, false);
  assert.ok(!/<animate/.test(still), 'still artwork must not animate forever');
  assert.ok(!/repeatCount="indefinite"/.test(still));
});

test('animated flower artwork still animates for the dashboard', () => {
  const ctx = load();
  assert.ok(/<animate/.test(ctx.smartFlowerSVG('Move more', 4)));
  assert.ok(/repeatCount="indefinite"/.test(ctx.smartFlowerSVG('Move more', 4)));
});

test('still and animated renders never share a cache slot', () => {
  const ctx = load();
  const still = ctx.smartFlowerSVG('Understand my cycle', 4, false);
  const live = ctx.smartFlowerSVG('Understand my cycle', 4);
  assert.notEqual(still, live);
  assert.equal(ctx.smartFlowerSVG('Understand my cycle', 4, false), still);
  assert.equal(ctx.smartFlowerSVG('Understand my cycle', 4), live);
});

test('the floating quick-action button does not use a drop-shadow filter', () => {
  const rules = html.match(/\.fab(?: img| svg)?\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 2, 'expected .fab rules in index.html');
  rules.forEach(r => assert.ok(!/drop-shadow/.test(r), 'filter repaints the fixed FAB: ' + r.slice(0, 60)));
  assert.ok(!/<animate/.test(html.match(/function fabIconHTML[\s\S]*?\n\}/)[0]), 'FAB icon must be the still artwork');
});

test('the FAB cancels its pointerdown so the opening tap cannot click the ring', () => {
  const i = html.indexOf("fabEl.addEventListener('pointerdown'");
  assert.ok(i > 0, 'FAB pointerdown handler present');
  const block = html.slice(i, html.indexOf('});', i) + 3);
  assert.ok(/preventDefault\(\)/.test(block), 'without it WebView fires a compatibility click on the freshly mounted core');
});

test('the opening tap cannot synthesise a click on the ring core', () => {
  const i = html.indexOf("fabEl.addEventListener('touchend'");
  assert.ok(i > 0, 'FAB cancels touchend');
  const block = html.slice(i, html.indexOf('});', i) + 3);
  assert.ok(/preventDefault\(\)/.test(block), 'synthetic click must be suppressed');
  assert.ok(/passive:false/.test(block), 'a passive listener cannot cancel the click');
});

test('the ring entrance frame is not interactive', () => {
  assert.ok(/\.qaring:not\(\.on\) \.qaring-core\{|\.qaring:not\(\.on\) \.qaring-core,/.test(html));
  assert.ok(/\.qaring:not\(\.on\)[^{]*\.qaring-scrim/.test(html));
});

test('every quick-action label stays readable', () => {
  const ctx = load();
  const degs = [0, 60, 120, 180, 240, 300];
  const rots = degs.map(d => ctx.qaLabelRot(d));
  rots.forEach(r => assert.ok(r > -90 && r <= 90, 'rotation out of range: ' + r));
  assert.deepEqual(rots, [0, -60, 60, 0, -60, 60]);
  assert.equal(ctx.qaLabelRot(90), 90);
  assert.equal(ctx.qaLabelRot(270), 90);
});

test('the picker and the FAB show the pre-rendered bitmaps', () => {
  const i = html.indexOf('fabOpts.innerHTML=');
  const block = html.slice(i, html.indexOf("join('')", i) + 8);
  assert.ok(/assets\/fab\//.test(block), 'picker uses the bitmaps');
  assert.ok(!/smartFlowerSVG\(/.test(block), 'no live illustrations in the picker');
  const j = html.indexOf('function fabIconHTML');
  const fab = html.slice(j, html.indexOf('\n}', j));
  assert.ok(/assets\/fab\//.test(fab), 'FAB uses the bitmap');
});

test('every pre-rendered bloom exists and stays small', () => {
  const ids = ['hydrangea', 'sunflower', 'daisy', 'zinnia', 'rose', 'chrysanthemum', 'bougainvillea'];
  for (const id of ids) {
    const file = path.join(__dirname, '..', 'assets', 'fab', id + '.png');
    const st = fs.statSync(file);
    assert.ok(st.size > 1000 && st.size < 80000, id + '.png is ' + st.size + ' bytes');
  }
});

test('every cover thumbnail referenced by the stylesheet exists', () => {
  const html2 = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const block = html2.slice(html2.indexOf('const COVER_STYLES'), html2.indexOf('const COVER_TITLES'));
  const names = [...new Set([...block.matchAll(/([a-z0-9-]+)\.jpg/g)].map(m => m[1]))];
  assert.ok(names.length >= 20, 'found ' + names.length + ' cover artworks');
  for (const n of names) {
    const f = path.join(__dirname, '..', 'assets', 'library', 'thumbs', n + '.webp');
    assert.ok(fs.existsSync(f), 'missing thumbnail: ' + n + '.webp');
  }
});

test('no infinite shimmer runs on library cards', () => {
  const rule = html.match(/\.bookcard-cover\{[^}]*\}/g) || [];
  assert.ok(rule.length, 'bookcard-cover rule present');
  rule.forEach(r => {
    assert.ok(!/animation:[^;]*infinite/.test(r), 'per-card infinite animation repaints the whole grid');
  });
  assert.ok(!/coverShimmer/.test(html), 'dead keyframes removed');
});

test('library cards do not use content-visibility with guessed intrinsic sizes', () => {
  const rule = (html.match(/\.bookcard\{[^}]*\}/g) || [])[0] || '';
  assert.ok(rule, 'bookcard rule present');
  assert.ok(!/content-visibility/.test(rule), 'measured 46ms layout spikes on device');
  assert.ok(!/contain-intrinsic-size/.test(rule), 'size guessing shifts the grid while scrolling');
});

test('cover images do not fade in (mid-scroll layer promotion flickers neighbours)', () => {
  const rule = (html.match(/\.cover-bg\{[^}]*\}/g) || [])[0] || '';
  assert.ok(rule, 'cover-bg rule present');
  assert.match(rule, /opacity:1/);
  assert.ok(!/transition:[^;]*opacity/.test(rule), 'no opacity transition on covers');
  const pill = (html.match(/\.card-genre\{[^}]*\}/g) || [])[0] || '';
  assert.match(pill, /translateZ\(0\)/);
});
