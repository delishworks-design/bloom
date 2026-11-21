const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const manifest = { versionCode: 205, versionName: '2.1.4', url: 'https://example.test/bloom-2.1.4.apk', notes: 'Fixes' };
const current = { versionCode: 204, versionName: '2.1.3' };

test('no newer version means no update', () => {
  const { updateState } = load();
  assert.equal(updateState(null, current, 0, null), 'none');
  assert.equal(updateState(current, current, 0, null), 'none');
});

test('dismissed versions stay dismissed until a manual check', () => {
  const { updateState } = load();
  assert.equal(updateState(manifest, current, 205, null), 'skipped');
});

test('a matching downloaded file is ready to install', () => {
  const { updateState } = load();
  assert.equal(updateState(manifest, current, 0, { available: true, url: manifest.url }), 'ready');
});

test('an unrelated pending file is not treated as this update', () => {
  const { updateState } = load();
  assert.equal(updateState(manifest, current, 0, { available: true, url: 'https://example.test/old.apk' }), 'available');
  assert.equal(updateState(manifest, current, 0, null), 'available');
});
