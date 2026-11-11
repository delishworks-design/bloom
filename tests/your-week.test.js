const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

function ctx() {
  const mod = load();
  mod.today = () => '2026-01-20';
  mod.sbUser = { id: 'u1' };
  mod.sbInit = async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } });
  mod.SB = { key: 'anon' };
  return mod;
}

function baseFacts(overrides) {
  const f = {
    goals: ['Better sleep', 'Steadier energy', 'Understand my cycle'],
    phase: 'Luteal',
    phaseLabel: 'Luteal phase',
    cycleDay: 18,
    daysToPeriod: 10,
    week: [
      { label: 'Sleep', now: 6.4, prev: 7.6 },
      { label: 'Energy', now: 3.2, prev: 2.8 }
    ],
    comingUp: [
      { phaseLabel: 'Menstrual phase', startsIn: 10, mood: 3, energy: 2.5, stress: 3.5, symptoms: ['Cramps', 'Fatigue'] }
    ],
    focus: { headline: 'Sleep 6.4 h last week', metric: '6.4 h (4 under 7h)', trend: 'sleep 6.4 vs 7.6 h' }
  };
  return Object.assign(f, overrides || {});
}

function weekCtx(overrides) {
  return Object.assign({
    logs: {
      '2026-01-14': { sleep: 6, energy: 3, mood: 3 },
      '2026-01-15': { sleep: 6, energy: 3, mood: 3 },
      '2026-01-16': { sleep: 7, energy: 4, mood: 4 },
      '2026-01-07': { sleep: 8, energy: 3, mood: 3 },
      '2026-01-08': { sleep: 8, energy: 3, mood: 3 },
      '2026-01-09': { sleep: 7, energy: 2, mood: 3 }
    },
    startDates: ['2025-12-04', '2026-01-01'],
    current: { state: 'estimated', phase: 'Luteal', phaseLabel: 'Luteal phase', cycleDay: 18, cycleLength: 28 },
    pred: { state: 'predicted', avg: 28, last: '2026-01-01', expected: '2026-01-29', rangeStart: '2026-01-26', rangeEnd: '2026-02-01' },
    todayStr: '2026-01-20',
    meals: {},
    goals: ['Better sleep', 'Steadier energy'],
    ro: false
  }, overrides || {});
}

test('smartWeekFacts returns null in read-only mode and when there is no data', () => {
  const mod = ctx();
  assert.equal(mod.smartWeekFacts(weekCtx({ ro: true })), null);
  assert.equal(mod.smartWeekFacts({ logs: {}, startDates: [], current: { state: 'no-history' }, pred: {}, todayStr: '2026-01-20', meals: {}, goals: [], ro: false }), null);
});

test('smartWeekFacts strips private data and custom symptoms, caps sizes and strings', () => {
  const mod = ctx();
  const logs = {
    '2026-01-14': { sleep: 6, energy: 3, mood: 3, stress: 4, note: 'SECRET', sidefx: 'PRIVATE' },
    '2026-01-15': { sleep: 6, energy: 3, mood: 3, stress: 4 },
    '2026-01-16': { sleep: 7, energy: 4, mood: 4, stress: 3 },
    '2026-01-07': { sleep: 8, energy: 3, mood: 3, stress: 2 },
    '2026-01-08': { sleep: 8, energy: 3, mood: 3, stress: 2 },
    '2026-01-09': { sleep: 7, energy: 2, mood: 3, stress: 2 }
  };
  // add enough history for coming up symptoms
  logs['2025-12-10'] = { mood: 3, energy: 2, stress: 4, tags: ['Headache', 'CustomX'], customSx: ['MySecretSymptom'] };
  logs['2025-12-11'] = { mood: 3, energy: 2, stress: 4, tags: ['Headache', 'CustomX'], customSx: ['MySecretSymptom'] };
  logs['2025-12-12'] = { mood: 3, energy: 2, stress: 4, tags: ['Headache'], customSx: ['MySecretSymptom'] };
  const facts = mod.smartWeekFacts(weekCtx({ logs, goals: ['Better sleep', 'Steadier energy', 'Move more', 'Manage stress', 'Eat regularly'] }));
  assert.ok(facts);
  assert.ok(facts.goals.length <= 3);
  assert.ok(facts.week.length <= 4);
  assert.ok((facts.comingUp || []).length <= 3);
  (facts.comingUp || []).forEach(p => {
    assert.ok(p.symptoms.length <= 3);
    p.symptoms.forEach(s => assert.notEqual(s, 'MySecretSymptom'));
    p.symptoms.forEach(s => assert.notEqual(s, 'CustomX'));
  });
  const raw = JSON.stringify(facts);
  assert.ok(!raw.includes('SECRET'));
  assert.ok(!raw.includes('PRIVATE'));
  assert.ok(!raw.includes('MySecretSymptom'));
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(raw)); // no individual dates
  const allStrings = [];
  (function collect(v){ if (typeof v === 'string') allStrings.push(v); else if (Array.isArray(v)) v.forEach(collect); else if (v && typeof v === 'object') Object.values(v).forEach(collect); })(facts);
  allStrings.forEach(s => assert.ok(s.length <= 60, s));
});

test('smartWeekValidate rejects banned phrases, punctuation, emoji, em dash, length and bad numbers', () => {
  const mod = ctx();
  const facts = baseFacts();
  const ok = { headline: 'Energy up this week', summary: 'Energy 3.2 this week, up from 2.8. Day 18 in Luteal phase.', actions: ['Plan a lighter day', 'Keep a steady bedtime'] };
  assert.ok(mod.smartWeekValidate(ok, facts));

  const banned = ['it looks like', 'overall', 'remember', "it's important", 'great job', 'keep it up', 'journey', 'listen to your body', 'self-care', 'gentle reminder', 'consider', 'you might want', 'based on your', 'your data', 'your logs', 'tracking', 'AI', 'insight', 'pattern', 'balance', 'wellness', 'navigate', 'hang in there'];
  for (const phrase of banned) {
    assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { summary: `Energy 3.2 this week ${phrase} up from 2.8.` }), facts), null, phrase);
  }
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { headline: 'Energy up this week!' }), facts), null, 'exclamation');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { summary: 'Energy 3.2 this week 🙂 up from 2.8.' }), facts), null, 'emoji');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { summary: 'Energy 3.2 — up from 2.8 this week.' }), facts), null, 'em dash');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { headline: 'Energy up a lot this week again right now' }), facts), null, 'headline too long');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { summary: 'One 1. Two 2. Three 3. Four 4.' }), facts), null, 'too many sentences');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { summary: 'Energy 3.2 this week up from 2.8 in the last 7 days and day 18 in Luteal phase with period in 10 days and sleep 6.4 hours this week up from 7.6 and stress 3.5 this week up from 2.4 and mood 3.2.' }), facts), null, 'too many words');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { actions: ['plan a lighter day', 'Keep a steady bedtime'] }), facts), null, 'action not capitalized');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { actions: ['Plan a very very very very very very very long day', 'Keep a steady bedtime'] }), facts), null, 'action too long');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { summary: 'Energy 3.2 this week, up from 2.8. Slept 99 hours.' }), facts), null, 'number not in facts');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { summary: 'Energy 3.2 this week <b>up</b> from 2.8.' }), facts), null, 'html');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { summary: 'Energy 3.2 this week, diagnosis up from 2.8.' }), facts), null, 'medical');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { summary: 'Energy 8 this week, up from 2.8. Day 18 in Luteal phase.' }), { week: [{ label: 'Energy', now: 6.2, prev: 7.1 }], comingUp: [], goals: ['Better sleep'] }), null, 'invented number 8');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { actions: ['Plan 1 lighter day', 'Keep a steady bedtime'] }), facts), null, 'digits in action');
});

test('smartWeekTemplate pluralizes days, lowercases symptoms, avoids filler and never says starts today', () => {
  const mod = ctx();
  const goals = ['Better sleep', 'Steadier energy', 'Move more', 'Manage stress', 'Understand my cycle', 'Prepare for doctor visits', 'Eat regularly'];
  for (const g of goals) {
    const facts = baseFacts({ goals: [g], week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Energy', now: 2.6, prev: 3.4 }, { label: 'Stress', now: 3.8, prev: 2.4 }] });
    const out = mod.smartWeekTemplate(facts);
    assert.ok(out, 'template for ' + g);
    assert.ok(mod.smartWeekValidate(out, facts), 'valid for ' + g);
    assert.ok(!/Keep logging this week|Check in tomorrow/.test(out.actions.join(' ')), 'no filler for ' + g);
    assert.ok(out.actions.every(a => !/\d/.test(a)), 'no digits in actions for ' + g);
  }
  const f0 = baseFacts({ daysToPeriod: 4, comingUp: [{ phaseLabel: 'Menstrual phase', startsIn: 0, mood: 3, energy: 2, stress: 3, symptoms: ['Cramps'] }, { phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: ['Cramps'] }] });
  const o0 = mod.smartWeekTemplate(f0);
  assert.ok(!/starts today|starts in 0 day/i.test(o0.summary), 'no starts today');
  assert.match(o0.summary, /Follicular phase starts in 2 days/);
  assert.match(o0.summary, /with cramps often logged/);
  assert.ok(mod.smartWeekValidate(o0, f0));
  const f1 = baseFacts({ daysToPeriod: 4, comingUp: [{ phaseLabel: 'Menstrual phase', startsIn: 1, mood: 3, energy: 2, stress: 3, symptoms: ['Cramps'] }] });
  const o1 = mod.smartWeekTemplate(f1);
  assert.match(o1.summary, /starts in 1 day/);
  assert.ok(!/starts in 1 days/.test(o1.summary));
  assert.ok(mod.smartWeekValidate(o1, f1));
  const f2 = baseFacts({ daysToPeriod: 4, comingUp: [{ phaseLabel: 'Menstrual phase', startsIn: 2, mood: 3, energy: 2, stress: 3, symptoms: [] }] });
  const o2 = mod.smartWeekTemplate(f2);
  assert.match(o2.summary, /starts in 2 days/);
  assert.ok(mod.smartWeekValidate(o2, f2));
  const fOnly0 = baseFacts({ daysToPeriod: 4, comingUp: [{ phaseLabel: 'Luteal phase', startsIn: 0, mood: 3, energy: 2, stress: 3, symptoms: ['Cramps'] }] });
  const oOnly0 = mod.smartWeekTemplate(fOnly0);
  assert.ok(!/Luteal phase starts/i.test(oOnly0.summary));
  assert.ok(mod.smartWeekValidate(oOnly0, fOnly0));
});

test('template is goal-led with natural sentences and no duplicate action topics', () => {
  const mod = ctx();
  const cases = [
    ['Better sleep', { week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Energy', now: 2.6, prev: 3.4 }, { label: 'Stress', now: 3.8, prev: 2.4 }] }, 'Stress up this week.'],
    ['Steadier energy', { week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Energy', now: 2.6, prev: 3.4 }, { label: 'Stress', now: 3.8, prev: 2.4 }] }, 'Stress up this week.'],
    ['Manage stress', { week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Energy', now: 2.6, prev: 3.4 }, { label: 'Stress', now: 3.8, prev: 2.4 }] }, 'Sleep down this week.'],
    ['Understand my cycle', { week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Energy', now: 2.6, prev: 3.4 }, { label: 'Stress', now: 3.8, prev: 2.4 }] }, 'Stress up this week.'],
    ['Move more', { week: [{ label: 'Energy', now: 3.2, prev: 2.8 }], focus: { headline: 'Active on 2 of 7 days', metric: '2 active days', trend: '2 vs 4 the week before' } }, 'Energy up this week.'],
    ['Eat regularly', { week: [{ label: 'Energy', now: 3.2, prev: 2.8 }], focus: { headline: 'All three meals planned on 3 of 7 days', metric: '3 of 7 complete', trend: '3 vs 5 the week before' } }, 'Energy up this week.'],
    ['Prepare for doctor visits', { week: [{ label: 'Energy', now: 3.2, prev: 2.8 }], focus: { headline: 'Summary ready for your next visit', metric: '3 cycles logged', trend: '28 day average' } }, 'Energy up this week.'],
  ];
  for (const [goal, extra, expectedStart] of cases) {
    const facts = baseFacts(Object.assign({ goals: [goal] }, extra));
    const out = mod.smartWeekTemplate(facts);
    assert.ok(out.summary.startsWith(expectedStart), goal + ' starts with focus: ' + out.summary);
    assert.ok(!/^\d+ of \d+ (days|complete)\./.test(out.summary), 'no bare fragment: ' + out.summary);
    assert.ok(mod.smartWeekValidate(out, facts));
  }
  // headline rules
  const fPeriodFar = baseFacts({ daysToPeriod: 6, goals: ['Better sleep'], week: [{ label: 'Sleep', now: 6.2, prev: 7.1 }] });
  assert.equal(mod.smartWeekTemplate(fPeriodFar).headline, 'Sleep down this week');
  const fPeriodNear = baseFacts({ daysToPeriod: 2, goals: ['Better sleep'], week: [{ label: 'Sleep', now: 6.2, prev: 7.1 }] });
  assert.equal(mod.smartWeekTemplate(fPeriodNear).headline, 'Period in 2 days');
  const fStress = baseFacts({ goals: ['Manage stress'], week: [{ label: 'Stress', now: 3.8, prev: 2.4 }] });
  assert.equal(mod.smartWeekTemplate(fStress).headline, 'Stress up this week');
  const fMove = baseFacts({ goals: ['Move more'], week: [{ label: 'Energy', now: 3.2, prev: 2.8 }], focus: { headline: 'Active on 2 of 7 days', metric: '2 active days', trend: '2 vs 4 the week before' } });
  assert.equal(mod.smartWeekTemplate(fMove).headline, 'Active days down this week');
  // first action by goal when its metric changed, second goal default, no duplicates
  const oSleep = mod.smartWeekTemplate(fPeriodFar);
  assert.equal(oSleep.actions[0], 'Try an earlier bedtime');
  assert.equal(oSleep.actions[1], 'Plan a short walk');
  assert.ok(oSleep.actions.filter(a => /bedtime/i.test(a)).length <= 1, 'no duplicate bedtime: ' + oSleep.actions.join('|'));
  const oMove = mod.smartWeekTemplate(fMove);
  assert.equal(oMove.actions[0], 'Plan a short walk');
  assert.ok(oMove.actions[0] !== oMove.actions[1]);
  const fStress2 = baseFacts({ goals: ['Manage stress'], week: [{ label: 'Stress', now: 3.8, prev: 2.4 }, { label: 'Sleep', now: 6.2, prev: 7.1 }] });
  const oStress2 = mod.smartWeekTemplate(fStress2);
  assert.equal(oStress2.actions[0], 'Protect one small routine');
  assert.ok(oStress2.actions[0] !== oStress2.actions[1]);
  assert.ok(mod.smartWeekValidate(oStress2, fStress2));
});

test('Your week template is deterministic for the same facts', () => {
  const mod = ctx();
  const facts = baseFacts();
  const a = mod.smartWeekTemplate(facts);
  const b = mod.smartWeekTemplate(facts);
  assert.deepEqual(a, b);
  assert.ok(mod.smartWeekValidate(a, facts));
});

test('Your week card renders, escapes, and sits after cycle before focus', () => {
  const mod = ctx();
  const extras = {
    week: [{ key: 'energy', label: 'Energy', now: 3.2, prev: 2.8, arrow: '↑' }],
    comingUp: null,
    focusGoals: ['Better sleep'],
    noGoals: false,
    selectedGoal: 'Better sleep',
    focus: { headline: 'Sleep 6.4 h last week', metric: null, trend: null, action: null },
    ro: false,
    weekCard: { headline: 'Energy <up>', summary: 'Energy 3.2 this week, up from 2.8.', actions: ['Plan <lighter> day', 'Keep logging this week'] },
    weekOpts: { showPrompt: true }
  };
  const html = mod.smartInsightsHTML({ state: 'single-start' }, { state: 'single-start' }, [], 'Alex', null, extras);
  assert.match(html, /Your week/);
  assert.match(html, /Next 3 days/);
  assert.ok(!html.includes('<up>'));
  assert.ok(html.includes('&lt;up&gt;'));
  assert.ok(html.includes('&lt;lighter&gt;'));
  const cycleIdx = html.indexOf('smart-cycle-title');
  const weekIdx = html.indexOf('id="smart-week"');
  const focusIdx = html.indexOf('id="smart-focus"');
  assert.ok(cycleIdx !== -1 && weekIdx !== -1 && focusIdx !== -1);
  assert.ok(cycleIdx < weekIdx && weekIdx < focusIdx, 'order cycle < week < focus');


  const ro = mod.smartInsightsHTML({ state: 'single-start' }, { state: 'single-start' }, [], 'Alex', null, Object.assign({}, extras, { ro: true, focus: null }));
  assert.ok(!ro.includes('id="smart-week"'));
});

test('deterministic copy variation is stable and bounded', () => {
  const mod = ctx();
  mod.ST.del('bloom_week_variants');
  mod.today = () => '2026-01-20';
  const a = mod.smartWeekVariantIndex('headline:sleep', 3, '2026-01-20');
  const b = mod.smartWeekVariantIndex('headline:sleep', 3, '2026-01-20');
  assert.equal(a, b);
  // different date may vary (not required to differ, but must be valid)
  const c = mod.smartWeekVariantIndex('headline:sleep', 3, '2026-01-21');
  assert.ok(c >= 0 && c < 3);
  // bounded history
  mod.ST.del('bloom_week_variants');
  for (let i = 1; i <= 15; i++) {
    const d = '2026-02-' + String(i).padStart(2, '0');
    mod.smartWeekVariantIndex('headline:sleep', 3, d);
  }
  const raw = mod.ST.get('bloom_week_variants');
  const hist = JSON.parse(raw);
  assert.ok(Array.isArray(hist['headline:sleep']));
  assert.ok(hist['headline:sleep'].length <= 14);
  const serialized = JSON.stringify(hist);
  assert.ok(!/SECRET|note|symptom/i.test(serialized));
});
