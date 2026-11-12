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

function load() {
  const sandbox = {};
  const code = extract(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), 'rename');
  vm.runInNewContext(code, sandbox, { filename: 'rename.js' });
  return sandbox;
}

test('renameTaskIn trims and updates the right task', () => {
  const { renameTaskIn } = load();
  const doc = { tasks: [{ id: 'a', t: 'Old' }, { id: 'b', t: 'Keep' }] };
  assert.equal(renameTaskIn(doc, 'a', '  New name  '), true);
  assert.equal(doc.tasks[0].t, 'New name');
  assert.equal(doc.tasks[1].t, 'Keep');
  assert.equal(renameTaskIn(doc, 'zz', 'X'), false);
  assert.equal(renameTaskIn(doc, 'a', '   '), false);
});

test('renameMealIn updates name only for the given day and index', () => {
  const { renameMealIn } = load();
  const doc = { meals: { '2026-01-02': [{ n: 'Rice', t: 'l', q: 2 }, { n: 'Fish', t: 'd' }] } };
  assert.equal(renameMealIn(doc, '2026-01-02', 0, '  Brown rice '), true);
  assert.equal(doc.meals['2026-01-02'][0].n, 'Brown rice');
  assert.equal(doc.meals['2026-01-02'][0].t, 'l');
  assert.equal(doc.meals['2026-01-02'][0].q, 2);
  assert.equal(doc.meals['2026-01-02'][1].n, 'Fish');
  assert.equal(renameMealIn(doc, '2026-01-02', 5, 'X'), false);
  assert.equal(renameMealIn(doc, '2026-01-03', 0, 'X'), false);
});
