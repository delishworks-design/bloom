const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

test('readNormalize fills defaults', () => {
  const { readNormalize } = load();
  const out = readNormalize({});
  assert.equal(out.goalMin, 5);
  assert.equal(out.goalBooks, 1);
  assert.equal(Object.keys(out.log).length, 0)
});

test('readNormalize keeps valid choices and replaces junk', () => {
  const { readNormalize } = load();
  const out = readNormalize({ read: { goalMin: 10, goalBooks: 24, log: { x: 42 } } });
  assert.equal(out.goalMin, 10);
  assert.equal(out.goalBooks, 24);
  assert.equal(out.log.x, 42);
  const junk = readNormalize({ read: { goalMin: 99, goalBooks: 7, log: null } });
  assert.equal(junk.goalMin, 5);
  assert.equal(junk.goalBooks, 1);
});

test('readGoalPct clamps to [0,1]', () => {
  const { readGoalPct } = load();
  assert.equal(readGoalPct(0, 5), 0);
  assert.equal(readGoalPct(150, 5), 0.5);
  assert.equal(readGoalPct(99999, 5), 1);
  assert.equal(readGoalPct(0, 0), 0);
});

test('formatMS renders m:ss', () => {
  const { formatMS } = load();
  assert.equal(formatMS(0), '0:00');
  assert.equal(formatMS(65), '1:05');
  assert.equal(formatMS(3600), '60:00');
});

test('computeStreak counts back consecutive days', () => {
  const { computeStreak } = load();
  const today = new Date();
  const isoDay = d => d.toISOString().slice(0, 10);
  const a = new Date(today); a.setDate(today.getDate() - 0); // today
  const b = new Date(today); b.setDate(today.getDate() - 1);
  const c = new Date(today); c.setDate(today.getDate() - 2);
  const log = { [isoDay(a)]: 10, [isoDay(b)]: 5, [isoDay(c)]: 1 };
  assert.equal(computeStreak(log), 3);
  assert.equal(computeStreak({}), 0);
});

test('weekDots returns Mon..Sun booleans', () => {
  const { weekDots } = load();
  // Wednesday 2026-11-11 -> Monday 2026-11-09
  const dots = weekDots({ '2026-11-09': 1, '2026-11-11': 1 }, new Date('2026-11-11T12:00'));
  // Wed Nov 11 2026 -> Sun Nov 8 start; Mon 9 true, Wed 11 true
  assert.equal(dots.join(','), 'false,true,false,true,false,false,false');
});

test('booksThisYear counts by finishedAt in given year', () => {
  const { booksThisYear } = load();
  const books = {
    a: { finished: true, finishedAt: new Date('2026-04-01').getTime() },
    b: { finished: true, finishedAt: new Date('2026-11-20').getTime() },
    c: { finished: true, finishedAt: new Date('2025-12-31').getTime() },
    d: { finished: false }
  };
  assert.equal(booksThisYear(books, 2026), 2);
  assert.equal(booksThisYear(books, 2025), 1);
});


test('booksThisYear counts from D.read.finished even when library book is missing', () => {
  const ctx = load();
  ctx.D = { library: { books: {} }, read: { finished: { a: new Date('2026-03-01').getTime(), b: new Date('2025-01-01').getTime() } } };
  assert.equal(ctx.booksThisYear({}, 2026), 1);
});
