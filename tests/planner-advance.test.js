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
  assert.equal(sel._weekdays.join(','), '1,3,5');
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

test('taskOn custom weekdays matches only those weekdays', () => {
  const { normalizeTask, taskOn } = load();
  const t = normalizeTask({ id:'c', t:'c', repeat:'custom', weekdays:[1,3,5], from:'2026-01-05' }); // 2026-01-05 is Monday
  assert.equal(taskOn(t, '2026-01-06'), false); // Tue
  assert.equal(taskOn(t, '2026-01-07'), true);  // Wed
  assert.equal(taskOn(t, '2026-01-08'), false); // Thu
  assert.equal(taskOn(t, '2026-01-09'), true);  // Fri
});

test('taskOn every-x-days every 3 days', () => {
  const { normalizeTask, taskOn } = load();
  const t = normalizeTask({ id:'e', t:'e', repeat:'every-x-days', interval:3, from:'2026-01-05' });
  assert.equal(taskOn(t, '2026-01-05'), true);
  assert.equal(taskOn(t, '2026-01-06'), false);
  assert.equal(taskOn(t, '2026-01-07'), false);
  assert.equal(taskOn(t, '2026-01-08'), true);
  assert.equal(taskOn(t, '2026-01-02'), false); // before from
});

test('taskOn every-x-weeks every 2 weeks on same weekday', () => {
  const { normalizeTask, taskOn } = load();
  const t = normalizeTask({ id:'e', t:'e', repeat:'every-x-weeks', interval:2, from:'2026-01-05' }); // Mon
  assert.equal(taskOn(t, '2026-01-05'), true);
  assert.equal(taskOn(t, '2026-01-12'), false); // 1 week
  assert.equal(taskOn(t, '2026-01-19'), true);  // 2 weeks
  assert.equal(taskOn(t, '2026-01-14'), false); // Wed
});

test('taskOn monthly on day 15', () => {
  const { normalizeTask, taskOn } = load();
  const t = normalizeTask({ id:'m', t:'m', repeat:'monthly', monthDay:15, from:'2026-01-01' });
  assert.equal(taskOn(t, '2026-01-15'), true);
  assert.equal(taskOn(t, '2026-02-15'), true);
  assert.equal(taskOn(t, '2026-01-14'), false);
});

test('taskOn monthly clamps to last day of short months', () => {
  const { normalizeTask, taskOn } = load();
  const t = normalizeTask({ id:'m', t:'m', repeat:'monthly', monthDay:31, from:'2026-01-01' });
  assert.equal(taskOn(t, '2026-01-31'), true);
  assert.equal(taskOn(t, '2026-02-28'), true); // 2026 not leap
  assert.equal(taskOn(t, '2026-02-27'), false);
});

test('normalizeTask rejects invalid interval and drops to none', () => {
  const { normalizeTask } = load();
  const out = normalizeTask({ id:'i', t:'i', repeat:'every-x-days', interval:0, from:'2026-01-01' });
  assert.equal(out.repeat, 'none');
});

test('normalizeTask rejects invalid monthly day', () => {
  const { normalizeTask } = load();
  const out = normalizeTask({ id:'m', t:'m', repeat:'monthly', monthDay:99, from:'2026-01-01' });
  assert.equal(out.repeat, 'none');
});

test('taskOn respects until boundary', () => {
  const { normalizeTask, taskOn } = load();
  const t = normalizeTask({ id:'u', t:'u', repeat:'daily', from:'2026-01-01', until:'2026-01-10' });
  assert.equal(taskOn(t, '2026-01-10'), true);
  assert.equal(taskOn(t, '2026-01-11'), false);
});

test('notes survive normalize-tack-on round trip', () => {
  const { normalizeTask, taskOn } = load();
  const raw = { id:'n', t:'whole note', repeat:'custom', weekdays:[6], from:'2026-01-05', note:'bring book' };
  const out = normalizeTask(raw);
  assert.equal(out.note, 'bring book');
  assert.equal(taskOn(out, '2026-01-10'), true);
});

test('legacy weekday _weekdays still works for backward compat', () => {
  const { taskOn } = load();
  const legacy = { id:'l', t:'legacy', repeat:'weekly', from:'2026-01-05', _weekdays:[1,3,5] };
  assert.equal(taskOn(legacy, '2026-01-07'), true);
  assert.equal(taskOn(legacy, '2026-01-06'), false);
});

test('plannerTabSet has no Week tab and labels the day tab Task', () => {
  const { plannerTabSet } = load();
  const mine = plannerTabSet(true, { tasks: true, meals: true, journal: true });
  assert.equal(mine.some(([k]) => k === 'week'), false);
  assert.ok(mine.some(([k, l]) => k === 'day' && l === 'Task'));
  const partner = plannerTabSet(false, { tasks: true, meals: true, journal: false });
  assert.equal(partner.some(([k]) => k === 'week'), false);
  assert.ok(partner.some(([k, l]) => k === 'day' && l === 'Task'));
});
