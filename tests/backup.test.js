const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const { makeBackup, validateBackup } = load();

test('validateBackup rejects wrong app/version/non-object', () => {
  assert.equal(validateBackup({ app: 'other', v: 1, doc: {} }).ok, false);
  assert.equal(validateBackup({ app: 'bloom', v: 2, doc: {} }).ok, false);
  assert.equal(validateBackup({ app: 'bloom', v: 1, doc: [] }).ok, false);
});

test('validateBackup strips unknown keys and partner', () => {
  const res = validateBackup({
    app: 'bloom',
    v: 1,
    doc: {
      p: { name: 'A', avatar: 'https://example.com/x.png', unknown: 'drop' },
      logs: { '2026-11-01': { mood: 3 } },
      partner: { code: 'ABC' },
      secret: 'drop'
    }
  });
  assert.equal(res.ok, true);
  assert.equal(res.doc.p.unknown, undefined);
  assert.equal(res.doc.partner, undefined);
  assert.equal(res.doc.secret, undefined);
  assert.equal(res.doc.p.avatar, undefined);
  assert.equal(res.doc.logs['2026-11-01'].mood, 3);
});

test('validateBackup hardening', () => {
  const res = validateBackup({
    app: 'bloom',
    v: 1,
    doc: {
      savedAt: 'bad',
      cons: 'yes',
      logs: { '2026-11-01': 'bad', savedAt: { mood: 1 } },
      tasks: [{ id: 'a', t: 'x'.repeat(10000) }, { noId: true }],
      journal: [{ id: 'j1', t: 'note' }],
      p: { name: 'A' }
    }
  });
  assert.equal(res.ok, true);
  assert.equal(res.doc.logs['2026-11-01'], undefined);
  assert.equal(res.doc.logs.savedAt, undefined);
  assert.equal(res.doc.tasks.length, 1);
  assert.equal(res.doc.tasks[0].t.length, 5000);
  assert.equal(res.doc.cons, undefined);
  assert.equal(res.doc.savedAt, undefined);
});

test('validateBackup accepts valid backup and round trips', () => {
  const original = {
    savedAt: 123,
    p: { name: 'A', avatar: 'data:image/png;base64,AAAA', bud: 50, waterGoal: 8, goals: ['g'], done: true, role: 'me' },
    logs: { d1: { mood: 3 } },
    tasks: [{ id: 't1', t: 'walk' }],
    done: { d1: { t1: true } },
    meals: {},
    journal: [{ id: 'j1', t: 'note' }],
    plan: {},
    games: {},
    cons: true,
    rem: { on: true, time: '20:00' },
    sxMigrated: 1,
    seedClean: 1,
    partner: { code: 'drop' },
    unknown: 'drop'
  };
  const backup = makeBackup(original);
  const res = validateBackup(backup);
  assert.equal(res.ok, true);
  assert.equal(res.doc.partner, undefined);
  assert.equal(res.doc.unknown, undefined);
  assert.equal(res.doc.p.name, 'A');
  assert.equal(res.doc.tasks[0].id, 't1');
  assert.equal(res.doc.journal[0].t, 'note');
});
