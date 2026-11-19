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

test('applyReadingDoc restores log, goals and finished map', () => {
  const ctx = load();
  ctx.D = { library: { books: {} } };
  ctx.applyReadingDoc({ goalMin: 10, goalBooks: 24, log: { '2026-11-17': 90 }, finished: { book1: 1700000000000 } });
  assert.equal(ctx.D.read.log['2026-11-17'], 90);
  assert.equal(ctx.D.read.goalMin, 10);
  assert.equal(ctx.D.read.goalBooks, 24);
  assert.equal(ctx.D.read.finished.book1, 1700000000000);
});

test('applyReadingDoc copies finishedAt onto library books', () => {
  const ctx = load();
  ctx.D = { library: { books: { b1: { finished: true, finishedAt: 1 } } } };
  ctx.applyReadingDoc({ goalMin: 5, goalBooks: 1, log: {}, finished: { b1: 999 } });
  assert.equal(ctx.D.library.books.b1.finishedAt, 999);
});

test('simultaneous reading increments on two devices are summed, not maxed', () => {
  const { readingMerge } = load();
  const base = { goalMin: 5, goalBooks: 1, log: { '2026-11-18': 30 } };
  // legacy 30s already recorded. Device A records another 60s; device B records another 60s independently.
  const devA = readingMerge(base, { legacyLog: { '2026-11-18': 30 }, logByDevice: { '2026-11-18': { devA: 60 } } });
  const devB = readingMerge(base, { legacyLog: { '2026-11-18': 30 }, logByDevice: { '2026-11-18': { devB: 60 } } });
  const merged = readingMerge(devA, devB);
  assert.equal(merged.log['2026-11-18'], 150); // 30 legacy + 60 A + 60 B
  assert.equal(merged.logByDevice['2026-11-18'].devA, 60);
  assert.equal(merged.logByDevice['2026-11-18'].devB, 60);
});

test('retrying the same device counter does not double-count seconds', () => {
  const { readingMerge } = load();
  const doc = { goalMin: 5, goalBooks: 1, legacyLog: { '2026-11-18': 30 }, logByDevice: { '2026-11-18': { devA: 90 } } };
  const once = readingMerge(doc, {});
  const twice = readingMerge(once, doc);
  assert.equal(twice.log['2026-11-18'], 120); // legacy 30 + this device's 90, not doubled
  assert.equal(JSON.stringify(once), JSON.stringify(twice));
});

test('legacy log snapshots from two devices are not summed twice', () => {
  const { readingMerge } = load();
  const a = { goalMin: 5, goalBooks: 1, log: { '2026-11-17': 120, '2026-11-18': 60 } };
  const b = { goalMin: 5, goalBooks: 1, log: { '2026-11-17': 120, '2026-11-18': 60 } };
  const merged = readingMerge(a, b);
  assert.equal(merged.log['2026-11-17'], 120);
  assert.equal(merged.log['2026-11-18'], 60);
});

test('an older explicit unfinished stamp beats a stale finished flag', () => {
  const { readingMerge } = load();
  const merged = readingMerge(
    { goalMin: 5, goalBooks: 1, finished: {}, unfinished: { b1: 500 } },
    { goalMin: 5, goalBooks: 1, finished: { b1: 100 } }
  );
  assert.equal(merged.finished.b1, undefined);
  assert.equal(merged.unfinished.b1, 500);
  // and a stale snapshot that still says "finished" cannot resurrect it either
  const again = readingMerge(merged, { goalMin: 5, goalBooks: 1, finished: { b1: 100 } });
  assert.equal(again.finished.b1, undefined);
});

test('a newer finished stamp beats an older unfinished stamp', () => {
  const { readingMerge } = load();
  const merged = readingMerge(
    { goalMin: 5, goalBooks: 1, finished: { b1: 700 } },
    { goalMin: 5, goalBooks: 1, unfinished: { b1: 200 } }
  );
  assert.equal(merged.finished.b1, 700);
  assert.equal(merged.unfinished.b1, undefined);
});

test('goals merge deterministically by their own timestamps', () => {
  const { readingMerge } = load();
  const olderRemote = readingMerge(
    { goalMin: 10, goalBooks: 12, goalMinAt: 5000, goalBooksAt: 5000, log: {} },
    { goalMin: 30, goalBooks: 24, goalMinAt: 100, goalBooksAt: 100, log: {} }
  );
  assert.equal(olderRemote.goalMin, 10);   // newer local wins
  assert.equal(olderRemote.goalBooks, 12);
  const newerRemote = readingMerge(
    { goalMin: 10, goalBooks: 12, goalMinAt: 100, goalBooksAt: 100, log: {} },
    { goalMin: 30, goalBooks: 24, goalMinAt: 5000, goalBooksAt: 5000, log: {} }
  );
  assert.equal(newerRemote.goalMin, 30);   // newer remote wins
  assert.equal(newerRemote.goalBooks, 24);
});
