const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

test('normalizeTask migrates legacy once -> from + none', () => {
  const { normalizeTask } = load();
  const out = normalizeTask({ id: 't1', t: 'x', once: '2026-05-03' });
  assert.equal(out.from, '2026-05-03');
  assert.equal(out.repeat, 'none');
});

test('normalizeTask migrates legacy days array to repeat rules', () => {
  const { normalizeTask } = load();
  const all = normalizeTask({ id: 't2', t: 'x', days: [0,1,2,3,4,5,6] });
  assert.equal(all.repeat, 'daily');
  const wk = normalizeTask({ id: 't3', t: 'x', days: [1,2,3,4,5] });
  assert.equal(wk.repeat, 'weekdays');
  const sel = normalizeTask({ id: 't4', t: 'x', days: [1,3,5] });
  assert.equal(sel.repeat, 'weekly');
  assert.deepEqual(sel._weekdays, [1,3,5]);
});

test('normalizeTask defaults missing from when nothing can be inferred', () => {
  const { normalizeTask } = load();
  const out = normalizeTask({ id: 't5', t: 'x' });
  assert.ok(out.from, 'from must be set');
  assert.equal(out.repeat, 'daily');
});

test('overdueList returns carry-forward tasks past their window but unfinished', () => {
  const { overdueList } = load();
  const doc = {
    tasks: [{ id: 'a', t: 'a', days: [1,2,3,4,5], carry: true, from: '1970-01-01' }],
    done: {}
  };
  const out = overdueList(doc, '2026-01-20');
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'a');
});

test('overdueList excludes tasks that are done today', () => {
  const { overdueList } = load();
  const doc = {
    tasks: [{ id: 'a', t: 'a', days: [1], carry: true }],
    done: { '2026-01-20': { a: true } }
  };
  const out = overdueList(doc, '2026-01-20');
  assert.equal(out.length, 0);
});

test('overdueList excludes tasks without carry', () => {
  const { overdueList } = load();
  const doc = {
    tasks: [{ id: 'a', t: 'a', days: [1,2,3,4,5] }],
    done: {}
  };
  const out = overdueList(doc, '2026-01-20');
  assert.equal(out.length, 0);
});

test('taskOn honors from and until', () => {
  const { taskOn } = load();
  const t = { id: 'x', t: 'x', from: '2026-01-05', until: '2026-01-20', repeat: 'daily' };
  assert.equal(taskOn(t, '2026-01-04'), false);
  assert.equal(taskOn(t, '2026-01-10'), true);
  assert.equal(taskOn(t, '2026-01-21'), false);
});

test('taskOn respects once and repeat rules', () => {
  const { taskOn } = load();
  assert.equal(taskOn({ id: 'a', t: 'a', from: '2026-01-10', repeat: 'none' }, '2026-01-10'), true);
  assert.equal(taskOn({ id: 'a', t: 'a', from: '2026-01-10', repeat: 'none' }, '2026-01-11'), false);
  assert.equal(taskOn({ id: 'a', t: 'a', from: '2026-01-05', repeat: 'weekdays' }, '2026-01-10'), false); // Saturday
  assert.equal(taskOn({ id: 'a', t: 'a', from: '2026-01-05', repeat: 'weekdays' }, '2026-01-12'), true);  // Monday
});
