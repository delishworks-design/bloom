const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const ctx = load();

test('E escapes HTML metacharacters', () => {
  const escaped = ctx.E('<img src=x onerror=alert(1)>');
  assert.ok(!escaped.includes('<img'));
  assert.ok(escaped.includes('&lt;img'));
  assert.ok(escaped.includes('&gt;'));
});

test('roWho uses followed person name', () => {
  ctx.D = { p: { name: 'Maria Cruz' } };
  assert.equal(ctx.roWho(), "Maria's");
  ctx.D = { p: {} };
  assert.equal(ctx.roWho(), 'Their');
});

test('migrateCustomSymptoms moves unknown tags and is idempotent', () => {
  ctx.RO = false;
  ctx.D = { sxMigrated: 0, logs: { d1: { tags: ['Cramps', 'Joint pain'], customSx: [] } } };
  ctx.migrateCustomSymptoms();
  assert.deepEqual(ctx.D.logs.d1.tags, ['Cramps']);
  assert.deepEqual(ctx.D.logs.d1.customSx, ['Joint pain']);
  const before = JSON.stringify(ctx.D);
  ctx.migrateCustomSymptoms();
  assert.equal(JSON.stringify(ctx.D), before);
});

test('migrateCustomSymptoms does nothing in RO', () => {
  ctx.RO = true;
  ctx.D = { sxMigrated: 0, logs: { d1: { tags: ['Cramps', 'Joint pain'], customSx: [] } } };
  ctx.migrateCustomSymptoms();
  assert.equal(ctx.D.sxMigrated, 0);
  assert.deepEqual(ctx.D.logs.d1.tags, ['Cramps', 'Joint pain']);
});
