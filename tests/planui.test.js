const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const { shareFlags, plannerTabSet, ringPillBare, peerLabel } = load();

test('shareFlags: absent share keeps legacy tasks/meals shared, journal private', () => {
  const f = shareFlags({ p: {} });
  assert.equal(f.state, 'default');
  assert.equal(f.tasks, true);
  assert.equal(f.meals, true);
  assert.equal(f.journal, false);
});

test('shareFlags: shared exposes journal', () => {
  const f = shareFlags({ p: { share: 'shared' } });
  assert.equal(f.state, 'shared');
  assert.equal(f.tasks, true);
  assert.equal(f.meals, true);
  assert.equal(f.journal, true);
});

test('shareFlags: private hides planner and journal', () => {
  const f = shareFlags({ p: { share: 'private' } });
  assert.equal(f.state, 'private');
  assert.equal(f.tasks, false);
  assert.equal(f.meals, false);
  assert.equal(f.journal, false);
});

test('shareFlags: unknown values fall back to default and tolerate junk input', () => {
  assert.equal(shareFlags({ p: { share: 'nonsense' } }).state, 'default');
  assert.equal(shareFlags(null).state, 'default');
  assert.equal(shareFlags(undefined).tasks, true);
});

test('plannerTabSet: own panel always has journal, partner only when shared', () => {
  const mine = plannerTabSet(true, false).map(t => t[0]).join(',');
  assert.equal(mine, 'day,week,meals,journal');
  const theirsPrivate = plannerTabSet(false, false).map(t => t[0]).join(',');
  assert.equal(theirsPrivate, 'day,week,meals');
  const theirsShared = plannerTabSet(false, true).map(t => t[0]).join(',');
  assert.equal(theirsShared, 'day,week,meals,journal');
});

test('ringPillBare: only the estimated irregular variant drops the pill', () => {
  assert.equal(ringPillBare('estimated', true), true);
  assert.equal(ringPillBare('estimated', false), false);
  assert.equal(ringPillBare('overdue', true), false);
  assert.equal(ringPillBare('no-history', true), false);
});

test('peerLabel: shared doc name wins, then profile, then fallback', () => {
  assert.equal(peerLabel('Schatzie', 'Tintin', 'Follower'), 'Schatzie');
  assert.equal(peerLabel('', 'Schatzie', 'Follower'), 'Schatzie');
  assert.equal(peerLabel(null, null, 'Follower'), 'Follower');
  assert.equal(peerLabel('   ', '  ', 'Follower'), 'Follower');
  assert.equal(peerLabel('', '', ''), 'Follower');
});
