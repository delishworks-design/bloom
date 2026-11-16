const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./load');

test('readingMerge keeps the larger per-day minutes from both devices', () => {
  const { readingMerge } = load();
  const local = { goalMin: 5, goalBooks: 12, log: { '2026-11-15': 100, '2026-11-16': 200 }, finished: { a: 100 } };
  const remote = { goalMin: 10, goalBooks: 24, log: { '2026-11-16': 50, '2026-11-17': 300 }, finished: { b: 200 } };
  const out = readingMerge(local, remote);
  assert.equal(out.goalMin, 10);
  assert.equal(out.goalBooks, 24);
  assert.equal(out.log['2026-11-15'], 100);
  assert.equal(out.log['2026-11-16'], 200);
  assert.equal(out.log['2026-11-17'], 300);
  assert.equal(out.finished.a, 100);
  assert.equal(out.finished.b, 200);
});

test('readingMerge falls back to local goals when remote is junk', () => {
  const { readingMerge } = load();
  const out = readingMerge({ goalMin: 10, goalBooks: 24, log: {} }, { goalMin: 99, goalBooks: 7, log: {} });
  assert.equal(out.goalMin, 10);
  assert.equal(out.goalBooks, 24);
});

test('readingMerge handles empty and malformed docs', () => {
  const { readingMerge } = load();
  const out = readingMerge(null, undefined);
  assert.equal(out.goalMin, 5);
  assert.equal(out.goalBooks, 1);
  assert.equal(Object.keys(out.log).length, 0);
  assert.equal(Object.keys(out.finished).length, 0);
});

test('readingMerge keeps the latest finishedAt for the same book', () => {
  const { readingMerge } = load();
  const out = readingMerge({ finished: { b1: 100 } }, { finished: { b1: 300 } });
  assert.equal(out.finished.b1, 300);
});

test('readingMerge is idempotent', () => {
  const { readingMerge } = load();
  const a = { goalMin: 5, goalBooks: 12, log: { d1: 60 }, finished: { x: 5 } };
  const once = readingMerge(a, { goalMin: 10, goalBooks: 24, log: { d1: 30, d2: 90 }, finished: { y: 9 } });
  const twice = readingMerge(once, { goalMin: 10, goalBooks: 24, log: { d1: 30, d2: 90 }, finished: { y: 9 } });
  assert.equal(JSON.stringify(once), JSON.stringify(twice));
});

test('index.html has dedicated reading table helpers and login wiring', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /function readingFetch\(/);
  assert.match(html, /function readingPush\(/);
  assert.match(html, /function readingLoadOnce\(/);
  assert.match(html, /from\('bloom_reading'\)/);
  assert.match(html, /await readingLoadOnce\(\)/);
});

test('blank() seeds a read bucket so cloud-doc replaces never drop it', () => {
  const ctx = load();
  // blank is provided by the vm sandbox in tests/load.js
  const b = ctx.blank();
  assert.ok(b.read, 'blank must include read');
  assert.equal(b.read.goalMin, 5);
  assert.equal(typeof b.read.log, 'object');
});
