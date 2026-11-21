const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const at = (iso) => new Date(iso).getTime();
const MIN = 60000;

test('waterNextAt picks the next five-minute slot from now', () => {
  const { waterNextAt } = load();
  const now = at('2026-11-21T10:00:00');
  assert.equal(waterNextAt(at('2026-11-21T08:00:00'), 0, now), at('2026-11-21T10:05:00'));
});

test('waterNextAt keeps an already armed future nudge', () => {
  const { waterNextAt } = load();
  const now = at('2026-11-21T10:00:00');
  assert.equal(waterNextAt(at('2026-11-21T08:00:00'), at('2026-11-21T10:05:00'), now), at('2026-11-21T10:05:00'));
});

test('waterNextAt moves five minutes past a fired nudge', () => {
  const { waterNextAt } = load();
  const now = at('2026-11-21T10:06:00');
  assert.equal(waterNextAt(at('2026-11-21T08:00:00'), at('2026-11-21T10:05:00'), now), at('2026-11-21T10:10:00'));
});

test('waterNextAt lets a fresh water log reset to one hour later', () => {
  const { waterNextAt } = load();
  const now = at('2026-11-21T10:06:00');
  assert.equal(waterNextAt(at('2026-11-21T11:06:00'), at('2026-11-21T10:05:00'), now), at('2026-11-21T11:10:00'));
});

test('waterWindow arms a short rolling set of one-shot slots and stops at the cutoff', () => {
  const { waterWindow } = load();
  const start = at('2026-11-21T10:00:00');
  const slots = waterWindow(start, at('2026-11-21T10:25:00'), 6);
  assert.equal(slots.length, 6);
  for (let k = 0; k < 6; k++) assert.equal(Number(slots[k]), start + k * 5 * MIN);
  assert.equal(waterWindow(start, at('2026-11-21T10:10:00'), 6).length, 3);
});

test('waterMsgFor rotates by slot and stays inside the message list', () => {
  const { waterMsgFor, WATER_MSGS } = load();
  const first = waterMsgFor(at('2026-11-21T08:00:00'));
  const next = waterMsgFor(at('2026-11-21T08:05:00'));
  assert.equal(WATER_MSGS.includes(first), true);
  assert.equal(WATER_MSGS.includes(next), true);
  assert.notEqual(first, next);
});
