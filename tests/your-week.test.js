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

test('template is goal-led and has no duplicate action topics', () => {
  const mod = ctx();
  const cases = [
    ['Better sleep', { week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Energy', now: 2.6, prev: 3.4 }, { label: 'Stress', now: 3.8, prev: 2.4 }] }, 'Sleep averaged 6.4 h this week, down from 7.6.'],
    ['Steadier energy', { week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Energy', now: 2.6, prev: 3.4 }, { label: 'Stress', now: 3.8, prev: 2.4 }] }, 'Energy averaged 2.6 this week, down from 3.4.'],
    ['Manage stress', { week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Energy', now: 2.6, prev: 3.4 }, { label: 'Stress', now: 3.8, prev: 2.4 }] }, 'Stress averaged 3.8 this week, up from 2.4.'],
    ['Understand my cycle', { week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Energy', now: 2.6, prev: 3.4 }, { label: 'Stress', now: 3.8, prev: 2.4 }] }, 'Day 18 in Luteal phase, period in 10 days.'],
    ['Move more', { week: [{ label: 'Energy', now: 3.2, prev: 2.8 }], focus: { headline: 'Active on 2 of 7 days', metric: '2 active days', trend: '2 vs 1 the week before' } }, '2 active days.'],
    ['Eat regularly', { week: [{ label: 'Energy', now: 3.2, prev: 2.8 }], focus: { headline: 'Meals on 4 of 7 days', metric: '4 of 7 days', trend: '3 vs 4 the week before' } }, '4 of 7 days.'],
    ['Prepare for doctor visits', { week: [{ label: 'Energy', now: 3.2, prev: 2.8 }], focus: { headline: 'Visit summary ready', metric: '3 cycles logged', trend: '28 day average' } }, '3 cycles logged.'],
  ];
  for (const [goal, extra, expectedStart] of cases) {
    const facts = baseFacts(Object.assign({ goals: [goal] }, extra));
    const out = mod.smartWeekTemplate(facts);
    assert.ok(out.summary.startsWith(expectedStart), goal + ' starts with focus: ' + out.summary);
    assert.ok(mod.smartWeekValidate(out, facts));
  }
  const fSleep = baseFacts({ goals: ['Better sleep'], week: [{ label: 'Sleep', now: 6.2, prev: 7.1 }] });
  const oSleep = mod.smartWeekTemplate(fSleep);
  const bedtime = oSleep.actions.filter(a => /bedtime/i.test(a)).length;
  assert.ok(bedtime <= 1, 'no duplicate bedtime: ' + oSleep.actions.join('|'));
  assert.ok(mod.smartWeekValidate(oSleep, fSleep));
  const fStress = baseFacts({ goals: ['Manage stress'], week: [{ label: 'Stress', now: 3.8, prev: 2.4 }, { label: 'Sleep', now: 6.2, prev: 7.1 }] });
  const oStress = mod.smartWeekTemplate(fStress);
  assert.notEqual(oStress.actions[0], oStress.actions[1]);
  assert.ok(mod.smartWeekValidate(oStress, fStress));
});

test('extractModelText parses response shapes and strips think blocks', () => {
  const mod = ctx();
  const weekJson = '{"week":{"headline":"Energy up","summary":"Energy 3.2 this week, up from 2.8. Day 18 in Luteal phase.","actions":["Plan a lighter day","Keep a steady bedtime"]}}';
  assert.equal(mod.extractModelText({ response: weekJson }), weekJson);
  assert.equal(mod.extractModelText({ choices: [{ message: { content: weekJson } }] }), weekJson);
  assert.equal(mod.extractModelText({ choices: [{ message: { content: [{ type: 'text', text: weekJson }] } }] }), weekJson);
  assert.equal(mod.extractModelText({ choices: [{ text: weekJson }] }), weekJson);
  assert.equal(mod.extractModelText({ output_text: weekJson }), weekJson);
  const withThink = '<think>reasoning here</think>' + weekJson;
  assert.equal(mod.extractModelText({ response: withThink }), weekJson);
  const thinkInside = 'prefix<think>hidden</think>' + weekJson;
  assert.equal(mod.extractModelText({ choices: [{ message: { content: thinkInside } }] }), 'prefix' + weekJson);
  assert.equal(mod.extractModelText(null), null);
  assert.equal(mod.extractModelText({}), null);
  assert.equal(mod.extractModelText({ response: 123 }), null);
});

test('aiWeekSummary respects attempt cap and rate limits', async () => {
  const mod = ctx();
  mod.aiSetConsent(true);
  mod.aiInflightReset();
  const facts = baseFacts();
  const bad = async () => ({ ok: true, json: async () => ({ week: { headline: 'Bad!', summary: 'overall 99.', actions: ['go', 'do'] } }) });
  const r1 = await mod.aiWeekSummary(facts, { store: mod.ST, today: '2026-01-20', token: 'tok', ignoreCache: true, fetch: bad });
  assert.equal(r1.state, 'invalid');
  mod.aiInflightReset();
  const r2 = await mod.aiWeekSummary(facts, { store: mod.ST, today: '2026-01-20', token: 'tok', ignoreCache: true, fetch: bad });
  assert.equal(r2.state, 'invalid');
  let calls = 0;
  mod.aiInflightReset();
  const r3 = await mod.aiWeekSummary(facts, { store: mod.ST, today: '2026-01-20', token: 'tok', ignoreCache: true, fetch: async () => { calls++; return bad(); } });
  assert.equal(r3.state, 'exhausted');
  assert.equal(calls, 0);

  // 429 stops immediately
  const mod2 = ctx(); mod2.aiSetConsent(true); mod2.aiInflightReset();
  const f429 = baseFacts({ goals: ['Manage stress'] });
  let c429 = 0;
  const r429 = await mod2.aiWeekSummary(f429, { store: mod2.ST, today: '2026-01-20', token: 'tok', ignoreCache: true, fetch: async () => { c429++; return { ok: false, status: 429 }; } });
  assert.equal(r429.state, 'unavailable');
  mod2.aiInflightReset();
  const r429b = await mod2.aiWeekSummary(f429, { store: mod2.ST, today: '2026-01-20', token: 'tok', ignoreCache: true, fetch: async () => { c429++; return { ok: false, status: 429 }; } });
  assert.equal(r429b.state, 'exhausted');
  assert.equal(c429, 1);

  // success cached, no request with consent off
  const mod3 = ctx(); mod3.aiSetConsent(true); mod3.aiInflightReset();
  const fok = baseFacts({ goals: ['Move more'] });
  const week = { headline: 'Energy up this week', summary: 'Energy 3.2 this week, up from 2.8. Day 18 in Luteal phase.', actions: ['Plan a lighter day', 'Keep a steady bedtime'] };
  let cok = 0;
  const okr = await mod3.aiWeekSummary(fok, { store: mod3.ST, today: '2026-01-20', token: 'tok', ignoreCache: true, fetch: async () => { cok++; return { ok: true, json: async () => ({ week }) }; } });
  assert.equal(okr.state, 'ok');
  mod3.aiInflightReset();
  const okr2 = await mod3.aiWeekSummary(fok, { store: mod3.ST, today: '2026-01-20', token: 'tok', fetch: async () => { cok++; return { ok: true, json: async () => ({ week }) }; } });
  assert.equal(okr2.state, 'cached');
  assert.equal(cok, 1);
  const mod4 = ctx(); mod4.aiInflightReset(); // consent off
  let coff = 0;
  const off = await mod4.aiWeekSummary(baseFacts({ goals: ['Eat regularly'] }), { store: mod4.ST, today: '2026-01-20', token: 'tok', fetch: async () => { coff++; return { ok: true, json: async () => ({ week }) }; } });
  assert.equal(off.state, 'disabled');
  assert.equal(coff, 0);
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
