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

test('wide screens show only a centered tagline over watercolor circles', () => {
  assert.match(html, /@media\(min-width:1024px\)\{\s*\.auth\{display:grid/);
  assert.match(html, /content:"a gentler way \\A to know your cycle\."/);
  assert.match(html, /top:50%;transform:translateY\(-50%\);width:calc\(50% - 4vw\);text-align:center/);
  assert.match(html, /radial-gradient\(circle at 18% 30%,rgba\(126,200,194/);
  assert.match(html, /radial-gradient\(circle at 31% 68%,rgba\(247,184,203/);
  assert.match(html, /#app::before\{content:'';position:fixed;inset:-8%[\s\S]{0,300}radial-gradient\(circle/);
  assert.doesNotMatch(html, /LOGO_SOFT/);
  assert.doesNotMatch(html, /--bloom-mark/);
  assert.match(html, /animation:authDrift/);
});

test('the auth card sits in the right grid column on wide screens', () => {
  assert.match(html, /\.auth \.card\{grid-column:2;/);
});

test('the login pastel background also covers the app', () => {
  assert.match(html, /#app::before\{content:'';position:fixed;inset:-8%;z-index:-1;pointer-events:none;opacity:\.45/);
  assert.match(html, /#app::before[\s\S]{0,400}radial-gradient\(circle at 18% 30%/);
});
