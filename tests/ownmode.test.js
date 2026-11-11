const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const { seedOwnDoc, blank } = load();
const fresh = () => ({ p: {}, logs: {}, tasks: [], done: {}, meals: {}, journal: [], plan: {} });

test('seedOwnDoc prefers cloud doc over local cache', () => {
  const cloud = Object.assign(blank(), { journal: [{ id: 'c', t: 'from cloud' }], savedAt: 500 });
  const cached = Object.assign(blank(), { journal: [{ id: 'l', t: 'from cache' }], savedAt: 900 });
  const out = seedOwnDoc(cloud, cached, 'Jess', null);
  assert.equal(out.journal[0].id, 'c');
  assert.equal(out.savedAt, 500);
});

test('seedOwnDoc falls back to local cache when cloud missing', () => {
  const cached = Object.assign(blank(), { savedAt: 123, tasks: [{ id: 't1', t: 'cached' }] });
  const out = seedOwnDoc(null, cached, 'Jess', null);
  assert.equal(out.tasks[0].id, 't1');
  assert.equal(out.savedAt, 123);
});

test('seedOwnDoc starts from blank when nothing exists', () => {
  const out = seedOwnDoc(null, null, 'Jess', null);
  assert.deepEqual(out.logs, {});
  assert.deepEqual(out.tasks, []);
  assert.equal(out.journal.length, 0);
});

test('seedOwnDoc does not mutate or alias its inputs', () => {
  const cloud = Object.assign(blank(), { journal: [{ id: 'c', t: 'x' }] });
  const out = seedOwnDoc(cloud, null, 'Jess', null);
  out.journal.push({ id: 'new', t: 'y' });
  assert.equal(cloud.journal.length, 1);
});

test('seedOwnDoc seeds partner identity when profile missing', () => {
  const out = seedOwnDoc(null, null, '  Partner Name  ', { a: 'PHOTO', c: { z: 2, x: 1, y: 1 } });
  assert.equal(out.p.name, 'Partner Name');
  assert.equal(out.p.avatar, 'PHOTO');
  assert.deepEqual(out.p.avatarCrop, { z: 2, x: 1, y: 1 });
});

test('seedOwnDoc keeps existing own name and avatar over partner identity', () => {
  const cloud = Object.assign(blank(), { p: { name: 'Me', avatar: 'MINE', avatarCrop: { z: 1, x: 5, y: 5 } } });
  const out = seedOwnDoc(cloud, null, 'Partner', { a: 'PHOTO' });
  assert.equal(out.p.name, 'Me');
  assert.equal(out.p.avatar, 'MINE');
  assert.deepEqual(out.p.avatarCrop, { z: 1, x: 5, y: 5 });
});

test('seedOwnDoc marks onboarding done so own mode skips partner onboarding', () => {
  const out = seedOwnDoc(null, null, 'Jess', null);
  assert.equal(out.p.done, true);
});
