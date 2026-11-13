const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

test('offline sentinel maps to the offline message', () => {
  const { errText, OFFLINE_MSG } = load();
  assert.equal(errText('offline'), OFFLINE_MSG);
});

test('browser connection errors map to the offline message', () => {
  const { errText, OFFLINE_MSG } = load();
  assert.equal(errText('net::ERR_INTERNET_DISCONNECTED'), OFFLINE_MSG);
  assert.equal(errText('net::ERR_NETWORK_CHANGED'), OFFLINE_MSG);
});

test('a failed fetch still maps to the server message', () => {
  const { errText } = load();
  assert.equal(errText('TypeError: Failed to fetch'), 'Could not reach the server. Check your connection.');
});

test('auth errors are not mistaken for network errors', () => {
  const { errText } = load();
  assert.equal(errText('Invalid login credentials'), 'Incorrect email or password.');
  assert.equal(errText('Email not confirmed'), 'Confirm your email address first.');
});

test('isOffline follows navigator.onLine', () => {
  const sandbox = load();
  assert.equal(sandbox.isOffline(), false);
  sandbox.navigator.onLine = false;
  assert.equal(sandbox.isOffline(), true);
});
