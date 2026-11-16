const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('"Use a different email" handler resets to email step and focuses it', () => {
  const i = html.indexOf("$('#ceDiff')");
  assert.ok(i > 0, 'ceDiff handler not found');
  const body = html.slice(i, i + 220);
  assert.ok(body.includes('__signupStep=1'), 'should set __signupStep=1');
  assert.ok(body.includes("authPrefill=''"), 'should clear authPrefill');
  assert.ok(body.includes("authView('up')"), 'should call authView up');
  assert.ok(body.includes("getElementById('u')"), 'should focus email input');
});

test('showCheckEmail on native branches to code entry, not the link', () => {
  const i = html.indexOf('function showCheckEmail');
  const body = html.slice(i, i + 400);
  assert.ok(/typeof isNative==='function'&&isNative\(\)/.test(body), 'should call isNative()');
  assert.ok(/showConfirmCode\(/.test(body), 'should call showConfirmCode');
});

test('confirm code sheet verifies with type signup and renders 6-digit input', () => {
  const i = html.indexOf('function showConfirmCode');
  assert.ok(i > 0, 'showConfirmCode not found');
  const body = html.slice(i, i + 2600);
  assert.ok(body.includes('type:\'signup\''), 'verifyOtp must use type=signup');
  assert.ok(body.includes('verifyOtp'), 'must use verifyOtp');
  assert.ok(body.includes('inputmode="numeric"'), 'must render numeric input');
  assert.ok(body.includes('maxlength="6"'), 'code field must be 6 chars max');
  assert.ok(body.includes('cicForm'), 'must render cicForm element');
});
