const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const {
  smartWeekCompare,
  smartComingUp,
  smartActiveGoals,
  smartGoalFocus,
  smartPatternsFromLogs,
  smartInsightsExtras,
  smartHistoricalPhaseFor
} = load();

const TODAY = '2026-01-20';

function estimated(extra) {
  return Object.assign({
    state: 'estimated',
    phase: 'Luteal',
    phaseLabel: 'Luteal phase',
    cycleDay: 10,
    cycleLength: 28,
    confidence: 'Limited history'
  }, extra || {});
}

function prediction(extra) {
  return Object.assign({
    state: 'predicted',
    last: '2026-01-01',
    expected: '2026-01-29',
    rangeStart: '2026-01-26',
    rangeEnd: '2026-02-01',
    avg: 28
  }, extra || {});
}

function ctx(overrides) {
  return Object.assign({
    logs: {},
    startDates: [],
    current: estimated(),
    pred: prediction(),
    todayStr: TODAY,
    meals: {}
  }, overrides || {});
}

test('smartActiveGoals filters invalid values and defaults when empty', () => {
  const empty = smartActiveGoals([]);
  assert.deepEqual([...empty.goals], ['Understand my cycle']);
  assert.equal(empty.noGoals, true);

  const invalid = smartActiveGoals(['Nope', 42, null]);
  assert.deepEqual([...invalid.goals], ['Understand my cycle']);
  assert.equal(invalid.noGoals, true);

  const valid = smartActiveGoals(['Better sleep', 'Nope', 'Better sleep', 'Move more']);
  assert.deepEqual([...valid.goals], ['Better sleep', 'Move more']);
  assert.equal(valid.noGoals, false);
});

test('smartWeekCompare compares two windows, applies arrows and marks lower stress as good', () => {
  const logs = {
    '2026-01-14': { mood: 4, energy: 3 },
    '2026-01-15': { mood: 4, energy: 3 },
    '2026-01-16': { mood: 4, energy: 3 },
    '2026-01-17': { stress: 2 },
    '2026-01-18': { stress: 2 },
    '2026-01-19': { stress: 2 },
    '2026-01-07': { mood: 3, energy: 3 },
    '2026-01-08': { mood: 3, energy: 3 },
    '2026-01-09': { mood: 3, energy: 3 },
    '2026-01-10': { stress: 4 },
    '2026-01-11': { stress: 4 },
    '2026-01-12': { stress: 4 }
  };
  const rows = smartWeekCompare(logs, TODAY);
  const byKey = Object.fromEntries(rows.map(r => [r.key, r]));

  assert.deepEqual([...rows.map(r => r.key)], ['mood', 'energy', 'stress']);
  assert.equal(byKey.mood.arrow, '↑');
  assert.equal(byKey.mood.now, 4);
  assert.equal(byKey.mood.prev, 3);
  assert.equal(byKey.energy.arrow, '→');
  assert.equal(byKey.stress.arrow, '↓');
  assert.equal(byKey.stress.good, true);
});

test('smartWeekCompare needs three values in each window', () => {
  const logs = {
    '2026-01-14': { mood: 4 },
    '2026-01-15': { mood: 4 },
    '2026-01-07': { mood: 2 },
    '2026-01-08': { mood: 2 },
    '2026-01-09': { mood: 2 }
  };
  assert.equal(smartWeekCompare(logs, TODAY).length, 0);
});

test('smartComingUp needs three logged days and ranks symptoms', () => {
  const logs = {
    '2025-12-10': { mood: 3, energy: 2, stress: 4, tags: ['Headache'] },
    '2025-12-11': { mood: 3, energy: 2, stress: 4, tags: ['Headache', 'Cramps'] },
    '2025-12-12': { mood: 3, energy: 2, stress: 4, tags: ['Headache'] },
    '2025-12-17': { mood: 4, energy: 3, stress: 2, tags: ['Bloating'] },
    '2025-12-18': { mood: 4, energy: 3, stress: 2, tags: ['Bloating'] },
    '2025-12-19': { mood: 4, energy: 3, stress: 2, tags: ['Bloating'] }
  };
  const cu = smartComingUp(logs, ['2025-12-04', '2026-01-01'], estimated(), prediction());

  assert.equal(cu.daysToPeriod, 19);
  const follicular = cu.phases.find(p => p.phase === 'Follicular');
  assert.ok(follicular);
  assert.equal(follicular.startsIn, 0);
  assert.equal(follicular.logged, 3);
  assert.equal(follicular.mood, 3);
  assert.equal(follicular.symptoms[0], 'Headache');
  assert.deepEqual([...follicular.symptoms], ['Headache', 'Cramps']);

  const ovulation = cu.phases.find(p => p.phase === 'Ovulation');
  assert.ok(ovulation);
  assert.equal(ovulation.startsIn, 4);
});

test('smartComingUp returns null without estimates or enough phase days', () => {
  const logs = {
    '2025-12-10': { mood: 3 },
    '2025-12-11': { mood: 3 }
  };
  assert.equal(smartComingUp(logs, ['2025-12-04', '2026-01-01'], estimated(), prediction()), null);
  assert.equal(smartComingUp(logs, [], { state: 'predicted' }, prediction()), null);
  assert.equal(smartComingUp(logs, [], estimated(), { state: 'predicted' }), null);
});

test('smartGoalFocus understands the cycle and cycle length trend', () => {
  const logs = {
    '2025-12-10': { mood: 3, energy: 2, stress: 4, tags: ['Headache'] },
    '2025-12-11': { mood: 3, energy: 2, stress: 4, tags: ['Headache'] },
    '2025-12-12': { mood: 3, energy: 2, stress: 4, tags: ['Headache'] }
  };
  const focus = smartGoalFocus('Understand my cycle', ctx({
    logs,
    startDates: ['2025-10-09', '2025-11-06', '2025-12-04', '2026-01-01']
  }));

  assert.match(focus.headline, /Day 10 of ~28 · Luteal phase/);
  assert.match(focus.metric, /Period expected in 19 days/);
  assert.match(focus.trend, /Last cycle 28 days vs 28 days before/);
  assert.match(focus.action, /Follicular phase starts today; Headache is most logged then\./);
});

test('smartGoalFocus says what is missing for the cycle goal', () => {
  const focus = smartGoalFocus('Understand my cycle', ctx({ current: { state: 'single-start' } }));
  assert.match(focus.headline, /Log period start dates to see this/);
  assert.equal(focus.metric, null);
  assert.equal(focus.trend, null);
  assert.equal(focus.action, null);
});

test('smartGoalFocus finds the most common companion of low energy days', () => {
  const logs = {
    '2026-01-14': { sleep: 5, energy: 2 },
    '2026-01-15': { sleep: 5, energy: 2 },
    '2026-01-16': { sleep: 5, energy: 2 },
    '2026-01-17': { sleep: 8, energy: 4 },
    '2026-01-18': { sleep: 8, energy: 4 },
    '2026-01-19': { sleep: 8, energy: 4 }
  };
  const focus = smartGoalFocus('Steadier energy', ctx({ logs }));

  assert.match(focus.headline, /Energy ranged 2–4 of 5 over 14 days/);
  assert.match(focus.metric, /Range 2/);
  assert.match(focus.action, /Short sleep was also recorded on most low-energy days\./);
});

test('energy companion line needs more than half of low-energy days', () => {
  const logs = {
    '2026-01-14': { sleep: 5, energy: 2, exMin: 30 },
    '2026-01-15': { sleep: 8, energy: 2, exMin: 30 },
    '2026-01-16': { sleep: 8, energy: 2, exMin: 30 },
    '2026-01-17': { sleep: 8, energy: 4 },
    '2026-01-18': { sleep: 8, energy: 4 }
  };
  const focus = smartGoalFocus('Steadier energy', ctx({ logs }));

  assert.equal(focus.action, 'Keep logging to spot what tends to drain your energy.');
});

test('stress companion line needs more than half of high-stress days', () => {
  const logs = {
    '2026-01-14': { stress: 4, sleep: 5 },
    '2026-01-15': { stress: 4, sleep: 8 },
    '2026-01-16': { stress: 4, sleep: 8 },
    '2026-01-09': { stress: 2, sleep: 8 },
    '2026-01-10': { stress: 2, sleep: 8 },
    '2026-01-11': { stress: 2, sleep: 8 }
  };
  const focus = smartGoalFocus('Manage stress', ctx({ logs }));

  assert.equal(focus.action, 'Protect one small routine on high-stress days.');
});

test('eat regularly stays quiet when the plan has every meal every day', () => {
  const meals = {};
  for (let i = 0; i < 7; i++) meals['2026-01-' + String(14 + i).padStart(2, '0')] = [{ t: 'b' }, { t: 'l' }, { t: 'd' }];
  const focus = smartGoalFocus('Eat regularly', ctx({ meals }));

  assert.equal(focus.action, null);
  assert.ok(!/missing from 0/.test(JSON.stringify(focus)));
});

test('extras carry the read-only flag and skip the focus calculation', () => {
  const extras = smartInsightsExtras({}, [], estimated(), prediction(), TODAY, {}, null, null, true);

  assert.equal(extras.ro, true);
  assert.equal(extras.focus, null);
  assert.ok(Array.isArray(extras.week));
});

test('read-only mode filters the stress-sleep pattern only', () => {
  const logs = {
    '2026-01-01': { stress: 5, sleep: 6, energy: 2 },
    '2026-01-02': { stress: 4, sleep: 6, energy: 2 },
    '2026-01-03': { stress: 5, sleep: 6, energy: 2 },
    '2026-01-04': { stress: 1, sleep: 8, energy: 4 },
    '2026-01-05': { stress: 2, sleep: 8, energy: 4 },
    '2026-01-06': { stress: 1, sleep: 8, energy: 4 }
  };
  const full = smartPatternsFromLogs(logs, []);
  const shared = smartPatternsFromLogs(logs, [], { ro: true });

  assert.ok(full.some(p => p.type === 'stress-sleep'));
  assert.ok(!shared.some(p => p.type === 'stress-sleep'));
  assert.ok(shared.some(p => p.type === 'sleep-energy'));
});

test('smartGoalFocus asks for more energy logs', () => {
  const focus = smartGoalFocus('Steadier energy', ctx({
    logs: { '2026-01-14': { energy: 3 }, '2026-01-15': { energy: 3 } }
  }));
  assert.match(focus.headline, /Log energy on more days to see this/);
});

test('smartGoalFocus flags low sleep quality despite enough hours', () => {
  const logs = {
    '2026-01-14': { sleep: 8, sleepq: 2 },
    '2026-01-15': { sleep: 8, sleepq: 2 },
    '2026-01-16': { sleep: 7.5, sleepq: 4 },
    '2026-01-09': { sleep: 7.2, sleepq: 3 },
    '2026-01-10': { sleep: 7.2, sleepq: 3 },
    '2026-01-11': { sleep: 7.2, sleepq: 3 }
  };
  const focus = smartGoalFocus('Better sleep', ctx({ logs }));

  assert.match(focus.headline, /Sleep 7\.8 h last week/);
  assert.match(focus.metric, /quality 2\.7\/5/);
  assert.match(focus.action, /Hours are fine but quality is low on 2 days/);
});

test('smartGoalFocus asks for more sleep nights', () => {
  const focus = smartGoalFocus('Better sleep', ctx());
  assert.match(focus.headline, /Log sleep on more nights to see this/);
});

test('smartGoalFocus counts active days and reuses the activity pattern', () => {
  const logs = {
    '2026-01-14': { exMin: 30, exercise: 'Walk', energy: 5 },
    '2026-01-16': { exMin: 30, exercise: 'Run', energy: 5 },
    '2026-01-17': { exMin: 5, exercise: 'Walk', energy: 2 },
    '2026-01-18': { exMin: 5, exercise: 'Walk', energy: 2 },
    '2026-01-09': { exMin: 30, exercise: 'Walk', energy: 4 }
  };
  const focus = smartGoalFocus('Move more', ctx({ logs }));

  assert.match(focus.headline, /Active on 2 of 7 days/);
  assert.match(focus.trend, /2 vs 1 the week before/);
  assert.match(focus.action, /20\+ min: energy/);
});

test('smartGoalFocus asks for activity logs', () => {
  const focus = smartGoalFocus('Move more', ctx());
  assert.match(focus.headline, /Log activity on more days to see this/);
});

test('smartGoalFocus describes meals as planned and names the missing meal', () => {
  const meals = {
    '2026-01-14': [{ t: 'b' }, { t: 'l' }, { t: 'd' }],
    '2026-01-15': [{ t: 'b' }, { t: 'l' }, { t: 'd' }],
    '2026-01-16': [{ t: 'b' }, { t: 'l' }, { t: 'd' }],
    '2026-01-17': [{ t: 'l' }, { t: 'd' }],
    '2026-01-18': [{ t: 'l' }, { t: 'd' }],
    '2026-01-19': [{ t: 'l' }, { t: 'd' }],
    '2026-01-20': [{ t: 'l' }, { t: 'd' }]
  };
  const focus = smartGoalFocus('Eat regularly', ctx({ meals }));

  assert.match(focus.headline, /All three meals planned on 3 of 7 days/);
  assert.match(focus.action, /Breakfast is missing from 4 of 7 days in your plan\./);
  assert.ok(!/ate /i.test(focus.headline + focus.metric + focus.trend + focus.action));
});

test('smartGoalFocus asks for meal plans when there are too few', () => {
  const focus = smartGoalFocus('Eat regularly', ctx());
  assert.match(focus.headline, /Add meals to your plan to see this/);
});

test('smartGoalFocus keeps the stress scale higher-is-worse and suggests a routine', () => {
  const logs = {
    '2026-01-14': { stress: 4, sleep: 5 },
    '2026-01-15': { stress: 4, sleep: 5 },
    '2026-01-16': { stress: 4, sleep: 5 },
    '2026-01-09': { stress: 2, sleep: 8 },
    '2026-01-10': { stress: 2, sleep: 8 },
    '2026-01-11': { stress: 2, sleep: 8 }
  };
  const focus = smartGoalFocus('Manage stress', ctx({ logs }));

  assert.match(focus.headline, /Stress 4\/5 last week/);
  assert.match(focus.trend, /4 vs 2 before/);
  assert.match(focus.metric, /3 high days/);
  assert.match(focus.action, /Protect one small routine on high-stress days\./);
  assert.ok(!/Stress 1\/5/.test(focus.headline));
});

test('smartGoalFocus asks for more stress logs', () => {
  const focus = smartGoalFocus('Manage stress', ctx({
    logs: { '2026-01-14': { stress: 4 }, '2026-01-15': { stress: 4 } }
  }));
  assert.match(focus.headline, /Log stress on more days to see this/);
});

test('smartGoalFocus summarizes for a doctor visit', () => {
  const logs = {
    '2026-01-14': { tags: ['Headache'] },
    '2026-01-15': { tags: ['Headache', 'Cramps'] },
    '2026-01-16': { tags: ['Bloating'] }
  };
  const focus = smartGoalFocus('Prepare for doctor visits', ctx({
    logs,
    startDates: ['2025-11-01', '2025-12-01', '2026-01-01']
  }));

  assert.match(focus.metric, /3 period starts in 90 days/);
  assert.match(focus.metric, /cycle avg 31d \(30–31\)/);
  assert.match(focus.trend, /Top symptoms: Headache/);
  assert.equal(focus.action, 'Use Export summary below to bring this to your visit.');
});

test('smartGoalFocus asks for data before a doctor visit summary', () => {
  const focus = smartGoalFocus('Prepare for doctor visits', ctx());
  assert.match(focus.headline, /Log period starts or symptoms to see this/);
});

test('stress and sleep pattern uses three days per group with Early confidence', () => {
  const logs = {
    '2026-01-01': { stress: 5, sleep: 6 },
    '2026-01-02': { stress: 4, sleep: 6 },
    '2026-01-03': { stress: 5, sleep: 6 },
    '2026-01-04': { stress: 1, sleep: 8 },
    '2026-01-05': { stress: 2, sleep: 8 },
    '2026-01-06': { stress: 1, sleep: 8 }
  };
  const patterns = smartPatternsFromLogs(logs, []);
  const stress = patterns.find(p => p.type === 'stress-sleep');

  assert.ok(stress);
  assert.equal(stress.id, 'stress-sleep');
  assert.equal(stress.confidenceLevel, 'Early');
  assert.ok(stress.score > 0 && stress.score <= 1);
  assert.ok(!Object.prototype.hasOwnProperty.call(stress, 'diff'));
  assert.ok(stress.detail.startsWith('So far: '));
  assert.equal(stress.tip, 'Wind down earlier on high-stress days.');
});

test('stress and sleep pattern needs three days in each group', () => {
  const logs = {
    '2026-01-01': { stress: 5, sleep: 6 },
    '2026-01-02': { stress: 4, sleep: 6 },
    '2026-01-04': { stress: 1, sleep: 8 },
    '2026-01-05': { stress: 2, sleep: 8 },
    '2026-01-06': { stress: 1, sleep: 8 }
  };
  assert.equal(smartPatternsFromLogs(logs, []).filter(p => p.type === 'stress-sleep').length, 0);
});

test('historical phase helper still anchors completed cycles for goal focus', () => {
  const phase = smartHistoricalPhaseFor('2025-12-10', ['2025-12-04', '2026-01-01']);
  assert.ok(phase);
  assert.equal(phase.completed, true);
});
