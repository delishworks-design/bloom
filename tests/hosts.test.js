const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function hosts() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const found = [...html.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)].map(m => m[1]);
  return [...new Set(found)].sort();
}

test('index.html only uses allowed external hosts', () => {
  const list = hosts();
  const allowed = [
    'api.github.com',
    'raw.githubusercontent.com',
    'vggaswbjsmyvfheofnnj.supabase.co'
  ];
  assert.deepEqual(list, allowed);
  assert.ok(!list.some(h => h.includes('googleapis') || h.includes('gstatic')));
});
