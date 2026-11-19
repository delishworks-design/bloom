const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261119000000_sync_revisions.sql'), 'utf8');

test('the blind direct-upsert fallback for the main document is gone', () => {
  assert.doesNotMatch(indexHtml, /from\('bloom_data'\)\.upsert/);
});

test('the main push goes through the compare-and-set RPC', () => {
  assert.match(indexHtml, /rpc\('bloom_push_doc'/);
});

test('forbidden RPC responses are surfaced and never treated as success', () => {
  assert.match(indexHtml, /data\.status==='forbidden'/);
  assert.match(indexHtml, /reportErr\('sync\.forbidden'/);
});

test('unknown RPC statuses are treated as failures, not success', () => {
  assert.match(indexHtml, /Unexpected sync status/);
});

test('every regular pull refreshes reading progress', () => {
  assert.match(indexHtml, /await readingLoadOnce\(\)/);
});

test('a three-way merge is implemented and used by the sync engine', () => {
  assert.match(indexHtml, /function mergeDocsThreeWay\(/);
  assert.match(indexHtml, /mergeDocsThreeWay\(base\?base\.doc:null,D,data\.doc/);
  assert.match(indexHtml, /mergeDocsThreeWay\(base\?base\.doc:null,D,row\.doc/);
});

test('the acknowledged base snapshot is keyed by Supabase UID', () => {
  assert.match(indexHtml, /bloom_ack_/);
  assert.match(indexHtml, /loadAckBase\(uid\)/);
  assert.match(indexHtml, /saveAckBase\(uid,doc,rev\)/);
});

test('push and pull share a serializing lock', () => {
  assert.match(indexHtml, /let syncLock=Promise\.resolve\(\)/);
  assert.match(indexHtml, /function sbPush\(\)\{return syncLocked\(pushMainOnce\)\}/);
  assert.match(indexHtml, /function sbPull\(\)\{return syncLocked\(pullMainOnce\)\}/);
});

test('polling is about 10-15 seconds and hidden documents do not poll', () => {
  assert.match(indexHtml, /setInterval\(syncTick,12000\)/);
  assert.match(indexHtml, /document\.hidden\)return/);
});

test('reading and library use revision compare-and-set RPCs, not blind upserts', () => {
  assert.match(indexHtml, /rpc\('bloom_push_reading'/);
  assert.match(indexHtml, /rpc\('bloom_push_library'/);
  assert.doesNotMatch(indexHtml, /bloom_reading'\)\.upsert/);
  assert.doesNotMatch(indexHtml, /bloom_library'\)\.upsert/);
});

test('migration adds revisions and compare-and-set RPCs without destructive DDL', () => {
  assert.match(migration, /add column if not exists rev bigint/);
  assert.match(migration, /bloom_push_reading/);
  assert.match(migration, /bloom_push_library/);
  assert.match(migration, /forbidden/);
  assert.match(migration, /rev = p_base_rev/);
  assert.match(migration, /security invoker/i);
  assert.doesNotMatch(migration, /drop table/i);
  assert.doesNotMatch(migration, /truncate/i);
  assert.doesNotMatch(migration, /delete from/i);
});

test('the partner library has a periodic refresh path, not just a one-shot fetch', () => {
  assert.match(indexHtml, /function partnerLibRefresh\(/);
  assert.match(indexHtml, /syncLocked\(partnerLibRefresh\)/);
});
