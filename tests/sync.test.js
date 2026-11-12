const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const { mergeDocs, chooseLoginDoc, blank } = load();

function hasNestedSavedAt(obj, root = true) {
  if (!obj || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(v => hasNestedSavedAt(v, false));
  if (!root && ('savedAt' in obj)) return true;
  return Object.values(obj).some(v => hasNestedSavedAt(v, false));
}

test('mergeDocs has no nested savedAt and root is max', () => {
  const a = { savedAt: 100, logs: { a: { mood: 5 } }, tasks: [{ id: 't1', t: 'A' }, { id: 't2', t: 'B' }], tags: ['a', 'b'], num: 1 };
  const b = { savedAt: 200, logs: { a: { energy: 4 } }, tasks: [{ id: 't2', t: 'B2' }, { id: 't3', t: 'C' }], tags: ['b', 'c'], num: 2 };
  const m = mergeDocs(a, b);
  assert.equal(hasNestedSavedAt(m), false);
  assert.equal(m.savedAt, 200);
  assert.equal(m.logs.a.mood, 5);
  assert.equal(m.logs.a.energy, 4);
  assert.deepEqual([...m.tasks.map(t => t.id)], ['t2', 't3', 't1']);
  assert.equal(m.tasks.find(t => t.id === 't2').t, 'B2');
  assert.deepEqual([...m.tags], ['b', 'c', 'a']);
  assert.equal(m.num, 2);
});

test('chooseLoginDoc respects dirty flag', () => {
  const keep = { savedAt: 100, logs: {}, tasks: [{ id: 't1' }], journal: [], done: {}, meals: {}, plan: {}, p: {} };
  const cloud = { savedAt: 300, logs: {}, tasks: [], journal: [] };
  assert.deepEqual(Array.from(chooseLoginDoc(keep, cloud, '0').tasks), []);
  assert.deepEqual(Array.from(chooseLoginDoc(keep, cloud, '1').tasks), [{ id: 't1' }]);
  assert.deepEqual(Array.from(chooseLoginDoc(keep, cloud, undefined).tasks), [{ id: 't1' }]);
  assert.deepEqual(Array.from(chooseLoginDoc(keep, null, '0').tasks), [{ id: 't1' }]);
  assert.equal(chooseLoginDoc({ savedAt: 1, logs: { a: { mood: 1 } }, tasks: [], journal: [], p: {} }, cloud, null).tasks.length, 0);
});

test('chooseLoginDoc merges dirty local with cloud data', () => {
  const keep = { savedAt: 100, logs: {}, tasks: [{ id: 'local' }], journal: [], done: {}, meals: {}, plan: {}, p: {} };
  const cloud = { savedAt: 300, logs: { a: { mood: 1 } }, tasks: [{ id: 'cloud' }], journal: [] };
  const out = chooseLoginDoc(keep, cloud, '1');
  assert.deepEqual([...out.tasks.map(t => t.id)].sort(), ['cloud', 'local']);
  assert.equal(out.logs.a.mood, 1);
});

test('chooseLoginDoc keeps a meals-only cloud doc', () => {
  const keep = { savedAt: 100, logs: {}, tasks: [], journal: [], meals: {}, plan: {}, p: {} };
  const cloud = { savedAt: 300, logs: {}, tasks: [], journal: [], meals: { '2026-01-20': [{ t: 'Soup' }] }, plan: {}, p: {} };
  const out = chooseLoginDoc(keep, cloud, '0');
  assert.equal(out.meals['2026-01-20'][0].t, 'Soup');
});

test('docHasContent ignores an empty reset but keeps real follower data', () => {
  const { docHasContent } = load();
  assert.equal(docHasContent(null), false);
  assert.equal(docHasContent({ logs: {}, tasks: [], journal: [], meals: {}, plan: {}, p: { name: 'Schatzie' } }), false);
  assert.equal(docHasContent({ logs: {}, tasks: [], journal: [{ id: 'j', t: 'kept' }] }), true);
  assert.equal(docHasContent({ logs: { '2026-01-20': { mood: 3 } } }), true);
});
