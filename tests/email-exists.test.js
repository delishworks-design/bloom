const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261122000000_email_exists.sql'), 'utf8');

test('signup rejects an email that already exists', () => {
  assert.match(html, /async function emailExists\(email\)/);
  assert.match(html, /cl\.rpc\('bloom_email_exists',\{p_email:/);
  assert.match(html, /taken===true\)\{setFieldErr\('u','That email already has an account/);
});

test('the RPC checks auth.users without exposing addresses', () => {
  assert.match(migration, /security definer/);
  assert.match(migration, /select 1 from auth\.users/);
  assert.match(migration, /returns boolean/);
  assert.match(migration, /grant execute .* to anon, authenticated/);
});

test('create-password card has no step dots and a full-width Back button', () => {
  assert.doesNotMatch(html, /step-dots/);
  assert.match(html, /id="back" style="margin-top:8px;width:100%"/);
});
