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
  const ok = { headline: 'Energy up this week', summary: 'Energy 3.2 this week, up from 2.8. Day 18 in Luteal phase.', actions: ['Plan a lighter day', 'Keep logging this week'] };
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
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { actions: ['plan a lighter day', 'Keep logging this week'] }), facts), null, 'action not capitalized');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { actions: ['Plan a very very very very very very very long day', 'Keep logging this week'] }), facts), null, 'action too long');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { summary: 'Energy 3.2 this week, up from 2.8. Slept 99 hours.' }), facts), null, 'number not in facts');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { summary: 'Energy 3.2 this week <b>up</b> from 2.8.' }), facts), null, 'html');
  assert.equal(mod.smartWeekValidate(Object.assign({}, ok, { summary: 'Energy 3.2 this week, diagnosis up from 2.8.' }), facts), null, 'medical');
});

test('smartWeekTemplate passes the validator for different goals', () => {
  const mod = ctx();
  const goals = ['Better sleep', 'Steadier energy', 'Move more', 'Manage stress', 'Understand my cycle', 'Prepare for doctor visits', 'Eat regularly'];
  for (const g of goals) {
    const facts = baseFacts({ goals: [g], week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Energy', now: 2.6, prev: 3.4 }, { label: 'Stress', now: 3.8, prev: 2.4 }] });
    const out = mod.smartWeekTemplate(facts);
    assert.ok(out, 'template for ' + g);
    assert.ok(mod.smartWeekValidate(out, facts), 'valid for ' + g);
  }
});

test('week cache: second call uses cache and no fetch is made', async () => {
  const mod = ctx();
  mod.aiSetConsent(true);
  mod.aiInflightReset();
  const facts = baseFacts();
  const week = { headline: 'Energy up this week', summary: 'Energy 3.2 this week, up from 2.8. Day 18 in Luteal phase.', actions: ['Plan a lighter day', 'Keep logging this week'] };
  mod.aiWeekCacheSet(facts, week, mod.ST, '2026-01-20');
  let calls = 0;
  const r = await mod.aiWeekSummary(facts, { store: mod.ST, today: '2026-01-20', token: 'tok', fetch: async () => { calls++; return { ok: true, json: async () => ({}) }; } });
  assert.equal(r.state, 'cached');
  assert.deepEqual(r.week, week);
  assert.equal(calls, 0);
});

test('aiWeekSummary falls back on 429, offline and invalid responses', async () => {
  const mod = ctx();
  mod.aiSetConsent(true);
  mod.aiInflightReset();
  const facts = baseFacts();
  const r429 = await mod.aiWeekSummary(facts, { store: mod.ST, today: '2026-01-20', token: 'tok', force: true, ignoreCache: true, fetch: async () => ({ ok: false, status: 429 }) });
  assert.equal(r429.state, 'unavailable');
  mod.aiInflightReset();
  const roff = await mod.aiWeekSummary(facts, { store: mod.ST, today: '2026-01-20', token: 'tok', force: true, ignoreCache: true, fetch: async () => { throw new Error('offline'); } });
  assert.equal(roff.state, 'error');
  mod.aiInflightReset();
  const rinv = await mod.aiWeekSummary(facts, { store: mod.ST, today: '2026-01-20', token: 'tok', force: true, ignoreCache: true, fetch: async () => ({ ok: true, json: async () => ({ week: { headline: 'Bad!', summary: 'overall 99.', actions: ['go', 'do'] } }) }) });
  assert.equal(rinv.state, 'invalid');
});

test('Your week card renders, escapes, shows prompt only when allowed, and sits after cycle before focus', () => {
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
  assert.match(html, /Make this more personal/);
  assert.match(html, /Sends summary numbers only, never your notes\./);
  const cycleIdx = html.indexOf('smart-cycle-title');
  const weekIdx = html.indexOf('id="smart-week"');
  const focusIdx = html.indexOf('id="smart-focus"');
  assert.ok(cycleIdx !== -1 && weekIdx !== -1 && focusIdx !== -1);
  assert.ok(cycleIdx < weekIdx && weekIdx < focusIdx, 'order cycle < week < focus');

  const noPrompt = mod.smartInsightsHTML({ state: 'single-start' }, { state: 'single-start' }, [], 'Alex', null, Object.assign({}, extras, { weekOpts: { showPrompt: false } }));
  assert.ok(!noPrompt.includes('Make this more personal'));

  const ro = mod.smartInsightsHTML({ state: 'single-start' }, { state: 'single-start' }, [], 'Alex', null, Object.assign({}, extras, { ro: true, focus: null }));
  assert.ok(!ro.includes('id="smart-week"'));
});
