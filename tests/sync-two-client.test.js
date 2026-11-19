const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

// A deterministic in-memory cloud standing in for Supabase:
// one JSONB document per user, a rev counter, compare-and-set on push.
function makeCloud() {
  let row = { doc: { savedAt: 1, logs: {}, tasks: [], journal: [], meals: {}, plan: {}, done: {}, library: { books: {} }, p: {}, rem: { on: false } }, rev: 1 };
  const copy = v => JSON.parse(JSON.stringify(v));
  return {
    pull() { return copy(row); },
    push(doc, baseRev) {
      doc = copy(doc);
      if (baseRev === row.rev) { row = { doc, rev: row.rev + 1 }; return { status: 'ok', rev: row.rev }; }
      return { status: 'conflict', rev: row.rev, doc: copy(row.doc) };
    }
  };
}

function makeDevice(cloud, seed) {
  const ctx = load();
  let local = seed ? JSON.parse(JSON.stringify(seed)) : { savedAt: 1, logs: {}, tasks: [], journal: [], meals: {}, plan: {}, done: {}, library: { books: {} }, p: {}, rem: { on: false } };
  let baseDoc = null, baseRev = 0;
  const snap = () => JSON.parse(JSON.stringify(local));
  return {
    ctx,
    local() { return snap(); },
    edit(fn) { fn(local); },
    pull() {
      const remote = cloud.pull();
      if (remote.rev <= baseRev) return 'noop';
      local = ctx.mergeDocsThreeWay(baseDoc, local, remote.doc);
      local._uid = 'me';
      baseDoc = JSON.parse(JSON.stringify(remote.doc)); baseRev = remote.rev;
      return 'applied';
    },
    push() {
      const sent = snap();
      const res = cloud.push(sent, baseRev);
      if (res.status === 'ok') { baseDoc = sent; baseRev = res.rev; return 'ok'; }
      // conflict: three-way merge against the last acknowledged base, then retry once
      local = ctx.mergeDocsThreeWay(baseDoc, local, res.doc);
      local._uid = 'me';
      baseDoc = JSON.parse(JSON.stringify(res.doc)); baseRev = res.rev;
      const res2 = cloud.push(local, baseRev);
      if (res2.status === 'ok') { baseDoc = snap(); baseRev = res2.rev; return 'merged-ok'; }
      return 'conflict';
    },
    sync() { const a = this.pull(); const b = this.push(); return { pull: a, push: b }; }
  };
}

test('different logs on the same date both survive a sync', () => {
  const cloud = makeCloud();
  const a = makeDevice(cloud), b = makeDevice(cloud);
  a.push(); // seeds the cloud with a blank doc at rev 2
  b.sync();
  a.edit(d => { d.logs['2026-11-18'] = { mood: 5 }; });
  b.edit(d => { d.logs['2026-11-18'] = { mood: 3, energy: 7 }; delete d.logs['2026-11-18'].mood; });
  a.sync(); b.sync(); a.sync(); b.sync();
  const la = a.local().logs['2026-11-18'];
  const lb = b.local().logs['2026-11-18'];
  assert.equal(la.mood, 5);
  assert.equal(lb.energy, 7);
  assert.equal(lb.mood, 5);
});

test('logs on different dates both survive', () => {
  const cloud = makeCloud();
  const a = makeDevice(cloud), b = makeDevice(cloud);
  a.push(); b.sync();
  a.edit(d => { d.logs['2026-11-17'] = { mood: 4 }; });
  b.edit(d => { d.logs['2026-11-18'] = { mood: 2 }; });
  a.sync(); b.sync(); a.sync(); b.sync();
  assert.equal(a.local().logs['2026-11-17'].mood, 4);
  assert.equal(a.local().logs['2026-11-18'].mood, 2);
  assert.equal(b.local().logs['2026-11-17'].mood, 4);
});

test('two different tasks added simultaneously both survive', () => {
  const cloud = makeCloud();
  const a = makeDevice(cloud), b = makeDevice(cloud);
  a.push(); b.sync();
  a.edit(d => { d.tasks.push({ id: 'a1', t: 'Water plant' }); });
  b.edit(d => { d.tasks.push({ id: 'b1', t: 'Buy oat milk' }); });
  a.sync(); b.sync(); a.sync(); b.sync();
  const ta = a.local().tasks.map(t => t.id).sort();
  const tb = b.local().tasks.map(t => t.id).sort();
  assert.deepEqual(ta, ['a1', 'b1']);
  assert.deepEqual(tb, ['a1', 'b1']);
});

test('two different journal entries added simultaneously both survive', () => {
  const cloud = makeCloud();
  const a = makeDevice(cloud), b = makeDevice(cloud);
  a.push(); b.sync();
  a.edit(d => { d.journal.push({ id: 'ja', d: '2026-11-18', t: 'A entry' }); });
  b.edit(d => { d.journal.push({ id: 'jb', d: '2026-11-18', t: 'B entry' }); });
  a.sync(); b.sync(); a.sync(); b.sync();
  assert.deepEqual(a.local().journal.map(j => j.id).sort(), ['ja', 'jb']);
  assert.deepEqual(b.local().journal.map(j => j.id).sort(), ['ja', 'jb']);
});

test('two meals on the same date both survive', () => {
  const cloud = makeCloud();
  const a = makeDevice(cloud), b = makeDevice(cloud);
  a.push(); b.sync();
  a.edit(d => { d.meals['2026-11-18'] = [{ id: 'm1', n: 'Soup', t: 'lunch' }]; });
  b.edit(d => { d.meals['2026-11-18'] = [{ id: 'm2', n: 'Salad', t: 'lunch' }]; });
  a.sync(); b.sync(); a.sync(); b.sync();
  const ra = (a.local().meals['2026-11-18'] || []).map(m => m.id).sort();
  const rb = (b.local().meals['2026-11-18'] || []).map(m => m.id).sort();
  assert.deepEqual(ra, ['m1', 'm2']);
  assert.deepEqual(rb, ['m1', 'm2']);
});

test('both devices edit different fields of the same task, both changes survive', () => {
  const cloud = makeCloud();
  const a = makeDevice(cloud), b = makeDevice(cloud);
  a.edit(d => { d.tasks = [{ id: 't1', t: 'Original', note: 'keep', done: false }]; });
  a.push(); b.sync();
  a.edit(d => { d.tasks[0].note = 'edited by A'; });
  b.edit(d => { d.tasks[0].done = true; });
  a.sync(); b.sync(); a.sync(); b.sync();
  const t = a.local().tasks.find(t => t.id === 't1');
  assert.equal(t.note, 'edited by A');
  assert.equal(t.done, true);
  const tb = b.local().tasks.find(t => t.id === 't1');
  assert.equal(tb.note, 'edited by A');
  assert.equal(tb.done, true);
});

test('both devices edit the same field: deterministic winner, loser preserved', () => {
  const cloud = makeCloud();
  const a = makeDevice(cloud), b = makeDevice(cloud);
  a.edit(d => { d.tasks = [{ id: 't1', t: 'Original' }]; });
  a.push(); b.sync();
  a.edit(d => { d.tasks[0].t = 'A wins'; });
  b.edit(d => { d.tasks[0].t = 'B wins'; });
  a.sync(); b.sync(); a.sync(); b.sync();
  const ta = a.local().tasks[0].t;
  const tb = b.local().tasks[0].t;
  assert.equal(ta, tb); // converged
  const conflicts = a.local()._sync.conflicts.filter(c => String(c.path).endsWith('tasks/t1/t'));
  assert.equal(conflicts.length, 1);
  const values = [conflicts[0].local, conflicts[0].remote].sort();
  assert.deepEqual(values, ['A wins', 'B wins']);
});

test('a deleted task does not reappear after a stale device syncs', () => {
  const cloud = makeCloud();
  const a = makeDevice(cloud), b = makeDevice(cloud);
  a.edit(d => { d.tasks = [{ id: 't1', t: 'Doomed' }, { id: 't2', t: 'Lives' }]; });
  a.push(); b.sync();
  a.edit(d => { d.tasks = d.tasks.filter(t => t.id !== 't1'); });
  a.sync();
  b.sync(); b.sync();
  assert.deepEqual(b.local().tasks.map(t => t.id), ['t2']);
  assert.deepEqual(a.local().tasks.map(t => t.id), ['t2']);
});

test('empty deletion does not get resurrected by a stale snapshot', () => {
  const cloud = makeCloud();
  const a = makeDevice(cloud), b = makeDevice(cloud);
  a.edit(d => { d.tasks = [{ id: 't1', t: 'A' }]; d.journal = [{ id: 'j1', d: '2026-11-18', t: 'hello' }]; d.meals = { '2026-11-18': [{ id: 'm1', n: 'Soup' }] }; });
  a.push(); b.sync();
  a.edit(d => { d.tasks = []; d.journal = []; d.meals = {}; });
  a.sync(); b.sync(); b.sync();
  assert.deepEqual(b.local().tasks, []);
  assert.deepEqual(b.local().journal, []);
  assert.deepEqual(b.local().meals, {});
});

test('a stale device reconnects after a long offline period without restoring deletions', () => {
  const cloud = makeCloud();
  const a = makeDevice(cloud), b = makeDevice(cloud);
  a.edit(d => { d.tasks = [{ id: 't1', t: 'A' }, { id: 't2', t: 'B' }]; });
  a.push(); b.sync();
  a.edit(d => { d.tasks = [{ id: 't2', t: 'B' }]; });
  a.sync();
  a.edit(d => { d.journal.push({ id: 'j1', d: '2026-11-18', t: 'after offline' }); });
  a.sync();
  const baseSnapshot = b.local(); // what b last acknowledged
  const merged = b.ctx.mergeDocsThreeWay(baseSnapshot, b.local(), cloud.pull().doc);
  assert.deepEqual(Array.from(merged.tasks, t => t.id), ['t2']);
});

test('an RPC conflict causes a merge and retry without losing either update', () => {
  const cloud = makeCloud();
  const a = makeDevice(cloud), b = makeDevice(cloud);
  a.edit(d => { d.tasks = [{ id: 't1', t: 'Same' }]; });
  a.push(); b.sync();
  a.edit(d => { d.tasks[0].note = 'A was here'; });
  b.edit(d => { d.tasks[0].t = 'B renamed'; });
  const pa = a.sync();
  const pb = b.push(); // push over a stale rev: RPC conflict -> merge -> retry
  assert.equal(pb, 'merged-ok');
  a.pull();
  const t = a.local().tasks[0];
  assert.equal(t.note, 'A was here');
  assert.equal(t.t, 'B renamed');
});

test('repeated identical syncs do not create duplicate records', () => {
  const cloud = makeCloud();
  const a = makeDevice(cloud), b = makeDevice(cloud);
  a.push(); b.sync();
  a.edit(d => { d.tasks.push({ id: 'a1', t: 'Only once' }); });
  a.sync(); a.sync(); a.sync();
  b.sync(); b.sync(); b.sync();
  assert.equal(b.local().tasks.filter(t => t.id === 'a1').length, 1);
  assert.equal(a.local().tasks.length, 1);
});

test('meal entries keep their identity instead of being deduplicated by text', () => {
  const ctx = load();
  const base = { savedAt: 1, meals: { '2026-11-18': [{ id: 'm1', n: 'Soup', t: 'lunch', q: 1 }] }, tasks: [], journal: [], p: {}, rem: {} };
  const local = JSON.parse(JSON.stringify(base));
  local.meals['2026-11-18'] = [{ id: 'm1', n: 'Soup', t: 'lunch', q: 1 }, { id: 'm2', n: 'Soup', t: 'lunch', q: 1 }];
  const remote = JSON.parse(JSON.stringify(base));
  const merged = ctx.mergeDocsThreeWay(base, local, remote);
  assert.equal(merged.meals['2026-11-18'].length, 2);
  const merged2 = ctx.mergeDocsThreeWay(base, merged, remote);
  assert.equal(merged2.meals['2026-11-18'].length, 2);
});

test('a key missing on one side but not in the base is not treated as a deletion', () => {
  const ctx = load();
  // No trustworthy base snapshot: missing key must not be read as a delete.
  const local = { savedAt: 10, p: { name: 'Ann' } };
  const remote = { savedAt: 20, logs: { '2026-11-18': { mood: 3 } } };
  const merged = ctx.mergeDocsThreeWay(null, local, remote);
  assert.equal(merged.logs['2026-11-18'].mood, 3);
});

test('tombstones from a delete survive later merges with stale data', () => {
  const ctx = load();
  const base = { savedAt: 1, tasks: [{ id: 't1', t: 'Old' }], journal: [], meals: {}, p: {}, rem: {}, library: { books: {} } };
  const gone = JSON.parse(JSON.stringify(base));
  gone.tasks = [];
  const tombstoned = ctx.mergeDocsThreeWay(base, gone, base);
  assert.equal(tombstoned.tasks.length, 0);
  assert.ok(tombstoned._sync.tombstones['tasks/t1']);
  // now merge the tombstoned doc with the stale copy again
  const resurrected = JSON.parse(JSON.stringify(base));
  const merged = ctx.mergeDocsThreeWay(tombstoned, tombstoned, resurrected);
  assert.equal(merged.tasks.length, 0);
});

test('mergeDocsThreeWay is convergent regardless of merge order', () => {
  const ctx = load();
  const base = { savedAt: 1, tasks: [{ id: 't1', t: 'Orig', note: 'n', done: false }], logs: {}, journal: [], meals: {}, p: {}, rem: {}, library: { books: {} } };
  const a = JSON.parse(JSON.stringify(base)); a.tasks[0].note = 'A';
  const b = JSON.parse(JSON.stringify(base)); b.tasks[0].done = true;
  const ab = ctx.mergeDocsThreeWay(base, a, b);
  const ba = ctx.mergeDocsThreeWay(base, b, a);
  assert.equal(ab.tasks[0].note, 'A');
  assert.equal(ba.tasks[0].note, 'A');
  assert.equal(ab.tasks[0].done, true);
  assert.equal(ba.tasks[0].done, true);
});
