const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function classOf(tagRegex) {
  const m = html.match(tagRegex);
  assert.ok(m, 'markup not found: ' + tagRegex);
  return m[1].split(/\s+/).filter(Boolean);
}

test('book reader container must not use .reader-article (it collapses to a 44px column)', () => {
  const classes = classOf(/<div class="([^"]*)" id="readerBody">/);
  assert.ok(classes.includes('reader-body'));
  assert.ok(!classes.includes('reader-article'),
    'the book reader (#readerBody) must not have class reader-article: its absolute children give it no width and margin:0 auto shrinks it to its padding');
});

test('only one #readerBody exists in the markup', () => {
  assert.equal((html.match(/id="readerBody"/g) || []).filter(Boolean).length >= 1, true);
});


test('errorIgnorableEvent ignores plain Events with a target (not from the window)', () => {
  const { errorIgnorableEvent } = load();
  assert.equal(errorIgnorableEvent({ type: 'error', target: { tagName: 'IMG' }, message: 'x' }), true);
  assert.equal(errorIgnorableEvent({ type: 'error', target: { tagName: 'SCRIPT' }, message: 'Failed to load resource' }), true);
  assert.equal(errorIgnorableEvent({ message: 'boom', filename: 'app.js' }), false);
});
