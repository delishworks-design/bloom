const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('pairing lookups are cached and deduplicated', () => {
  assert.match(html, /const PAIR_TTL=8000/);
  assert.match(html, /if\(pairNet\.inflight\)return pairNet\.inflight/);
  assert.match(html, /if\(codeNet\.inflight\)return codeNet\.inflight/);
  assert.match(html, /const st=await pairState\(\)/);
});

test('the follower card only rewrites the DOM when content changed', () => {
  assert.match(html, /if\(box\.innerHTML!==html\)\{box\.innerHTML=html/);
});

test('the cache is invalidated when a code is created, revoked or the user logs out', () => {
  assert.match(html, /D\.partner=\{code:c,on:true\};save\(\);pairInvalidate\(\)/);
  assert.match(html, /D\.partner=\{code:'',on:false\};save\(\);pairInvalidate\(\)/);
  assert.match(html, /peekAt=0;pairInvalidate\(\)/);
});
