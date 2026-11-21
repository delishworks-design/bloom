const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./load');

test('wheel indexes wrap in both directions', () => {
  const { timeWheelValue } = load();
  assert.equal(timeWheelValue(12, 12), 0);
  assert.equal(timeWheelValue(-1, 12), 11);
  assert.equal(timeWheelValue(3, 2), 1);
});

test('12-hour selection converts to a correct 24-hour value', () => {
  const { timeWheelTo24, timeWheelFrom24 } = load();
  assert.equal(timeWheelTo24(12, 'AM'), 0);
  assert.equal(timeWheelTo24(12, 'PM'), 12);
  assert.equal(timeWheelTo24(1, 'PM'), 13);
  assert.equal(timeWheelTo24(11, 'AM'), 11);
  assert.deepEqual({ h: timeWheelFrom24(0).h, ampm: timeWheelFrom24(0).ampm }, { h: 12, ampm: 'AM' });
  assert.deepEqual({ h: timeWheelFrom24(12).h, ampm: timeWheelFrom24(12).ampm }, { h: 12, ampm: 'PM' });
  assert.deepEqual({ h: timeWheelFrom24(23).h, ampm: timeWheelFrom24(23).ampm }, { h: 11, ampm: 'PM' });
});

test('time picker uses a scrollable AM/PM column and renders its title', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /col\('wtAp',aps\)/);
  assert.match(html, /<h2>\$\{E\(title\)\}<\/h2>/);
  assert.doesNotMatch(html, /wt-ampm-btn/);
});
