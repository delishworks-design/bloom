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

function makeEnv(doc, userId) {
  const sandbox = {
    D: doc,
    RO: false,
    save() { sandbox.saves++; },
    saves: 0,
    uid: () => 'j-new',
    sbUser: { id: userId || 'u1' }
  };
  const code = extract(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), 'notemig');
  vm.runInNewContext(code, sandbox, { filename: 'notemig.js' });
  return sandbox;
}

test('daily notes move into journal once and leave the log', () => {
  const doc = {
    p: {},
    logs: { '2026-01-02': { flow: 'light', note: '  rough day  ' }, '2026-01-03': { flow: 'none' } },
    journal: []
  };
  const env = makeEnv(doc);
  env.migrateLogNotes();
  assert.equal(doc.logs['2026-01-02'].note, undefined);
  assert.equal(doc.logs['2026-01-02'].flow, 'light');
  assert.equal(doc.journal.length, 1);
  assert.equal(doc.journal[0].t, 'rough day');
  assert.equal(doc.journal[0].d, '2026-01-02');
  assert.equal(doc.journal[0].src, 'note');
  assert.equal(env.saves, 1);

  env.migrateLogNotes();
  assert.equal(doc.journal.length, 1);
  assert.equal(env.saves, 1);
});

test('note migration never touches another account doc', () => {
  const doc = { _uid: 'other', p: {}, logs: { '2026-01-02': { note: 'secret' } }, journal: [] };
  const env = makeEnv(doc, 'u1');
  env.migrateLogNotes();
  assert.equal(doc.logs['2026-01-02'].note, 'secret');
  assert.equal(doc.journal.length, 0);
  assert.equal(env.saves, 0);
});

test('note migration does not duplicate an existing entry for the same day', () => {
  const doc = { p: {}, logs: { '2026-01-02': { note: 'again' } }, journal: [{ id: 'old', d: '2026-01-02', t: 'again', src: 'note' }] };
  const env = makeEnv(doc);
  env.migrateLogNotes();
  assert.equal(doc.journal.length, 1);
  assert.equal(doc.logs['2026-01-02'].note, undefined);
});
