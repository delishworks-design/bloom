const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const own = { _uid: 'me', p: { waterGoal: 6 }, logs: { '2026-01-20': { water: 2, mood: 3 } }, tasks: [{ id: 't1', t: 'Mine' }], done: { '2026-01-20': { t1: true } } };
const partner = { _uid: 'them', p: { waterGoal: 8 }, logs: {}, tasks: [{ id: 'p1', t: 'Theirs' }], done: {} };

test('ownWidgetDoc prefers the active own doc', () => {
  const b = load();
  b.sbUser = { id: 'me' }; b.D = own; b.RO = false;
  assert.equal(b.ownWidgetDoc(), own);
});

test('ownWidgetDoc ignores an own cache belonging to a different account', () => {
  const b = load();
  b.sbUser = { id: 'me' }; b.RO = true; b.ownMode = false; b.D = partner; b.user = 'me@x.com';
  b.ST.set('bloom_d_me@x.com', JSON.stringify(partner));
  assert.equal(b.ownWidgetDoc(), null);
});

test('ownWidgetDoc uses a validated own cache while following', () => {
  const b = load();
  b.sbUser = { id: 'me' }; b.RO = true; b.ownMode = false; b.D = partner; b.user = 'me@x.com';
  b.ST.set('bloom_d_me@x.com', JSON.stringify(own));
  assert.equal(b.ownWidgetDoc()._uid, 'me');
});

test('widgetSnapshot carries the owner uid and own task state', () => {
  const b = load();
  b.sbUser = { id: 'me' }; b.D = own; b.RO = false;
  const snap = b.widgetSnapshot();
  assert.equal(snap.uid, 'me');
  assert.equal(snap.water, 2);
  assert.equal(snap.tasks[0].done, true);
  assert.equal(snap.tasks[0].t, 'Mine');
});

test('widgetSync never writes a partner snapshot while following', async () => {
  const b = load();
  b.sbUser = { id: 'me' }; b.RO = true; b.ownMode = false; b.D = partner; b.user = 'me@x.com';
  b.ST.set('bloom_d_me@x.com', JSON.stringify(own));
  const sent = [];
  b.widgetNative = () => ({ sync: async o => { sent.push(JSON.parse(o.data)) } });
  await b.widgetSync();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].uid, 'me');
  assert.equal(sent[0].tasks[0].t, 'Mine');
});

test('widgetSync skips when there is no own doc to show', async () => {
  const b = load();
  b.sbUser = { id: 'me' }; b.RO = true; b.D = partner;
  const sent = [];
  b.widgetNative = () => ({ sync: async o => { sent.push(o) } });
  await b.widgetSync();
  assert.equal(sent.length, 0);
});

test('widgetReset clears the native snapshot', async () => {
  const b = load();
  let called = 0;
  b.widgetNative = () => ({ reset: async () => { called++ } });
  await b.widgetReset();
  assert.equal(called, 1);
});
