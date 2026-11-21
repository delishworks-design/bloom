const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('remember me starts disabled until both credentials are entered', () => {
  assert.match(html, /id="rememb" type="checkbox" disabled/);
  assert.match(html, /const ok=!!remU\.value\.trim\(\)&&!!remP\.value;rem\.disabled=!ok/);
  assert.match(html, /remU\.addEventListener\('input',syncRem\);remP\.addEventListener\('input',syncRem\)/);
});

test('wide screens get an animated logo and tagline', () => {
  assert.match(html, /@media\(min-width:1024px\)\{\s*\.auth\{display:grid/);
  assert.match(html, /background:var\(--bloom-logo\)/);
  assert.match(html, /content:"A gentler way to know your cycle\."/);
  assert.match(html, /animation:authFloat/);
  assert.match(html, /setProperty\("--bloom-logo"/);
});
