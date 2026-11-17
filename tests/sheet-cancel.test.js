const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

test('sheetHasCancel detects a Cancel button by text', () => {
  const { sheetHasCancel } = load();
  assert.equal(sheetHasCancel('<button class="btn ghost" id="qCancel">Cancel</button>'), true);
});

test('sheetHasCancel detects known cancel ids even with custom text', () => {
  const { sheetHasCancel } = load();
  assert.equal(sheetHasCancel('<button id="finCancel">Not yet</button>'), true);
  assert.equal(sheetHasCancel('<button id="cx">Cancel</button>'), true);
});

test('sheetHasCancel is false for sheets with no cancel button', () => {
  const { sheetHasCancel } = load();
  assert.equal(sheetHasCancel('<h2>Reading goals</h2><button id="rrt">Time</button>'), false);
  assert.equal(sheetHasCancel(''), false);
});
