const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('reader locks the page behind it', () => {
  assert.match(html, /classList\.add\('reader-open'\)/);
  assert.match(html, /classList\.remove\('reader-open'\)/);
  assert.match(html, /html\.reader-open,html\.reader-open body,html\.reader-open #app\{overflow:hidden !important/);
});
