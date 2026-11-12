const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./load');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function renderContext() {
  const ctx = load();
  ctx.fmt = (date, opts) => new Date(`${date}T12:00`).toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric' });
  return ctx;
}

function predictedState(overdue = false) {
  return {
    state: 'predicted',
    startCount: 4,
    validCount: 3,
    last: '2026-03-26',
    expected: '2026-04-23',
    rangeStart: '2026-04-20',
    rangeEnd: '2026-04-30',
    min: 25,
    max: 35,
    avg: 28,
    overdue,
    confidence: 'Limited history'
  };
}

function currentState(extra) {
  return Object.assign({
    state: 'due-today',
    phase: null,
    phaseLabel: null,
    cycleDay: null,
    cycleLength: null,
    confidence: 'Limited history',
    predictedDate: '2026-04-23'
  }, extra || {});
}

function extras(overrides) {
  return Object.assign({
    selectedGoal: 'Better sleep',
    focusGoals: ['Better sleep', 'Understand my cycle'],
    noGoals: false,
    focus: {
      goal: 'Better sleep',
      headline: 'Sleep 6.8 h last week',
      metric: '6.8 h (3 under 7h)',
      trend: 'sleep 6.8 vs 7.2 h',
      action: 'Try a consistent wind-down time.'
    },
    week: [{ key: 'energy', label: 'Energy', now: 3.4, prev: 2.9, arrow: '↑' }],
    comingUp: {
      daysToPeriod: 10,
      phases: [{
        phase: 'Luteal',
        phaseLabel: 'Luteal phase',
        startsIn: 3,
        mood: 3.2,
        energy: 2.8,
        stress: 3.5,
        symptoms: ['Headache', 'Cramps']
      }]
    }
  }, overrides || {});
}

test('single header and no disclaimer, badge, count or progress list in Insights', () => {
  const { smartInsightsHTML } = renderContext();
  const out = smartInsightsHTML(predictedState(), currentState(), [], 'Alex');

  assert.equal((out.match(/Smart Insights/g) || []).length, 1);
  assert.ok(!/smart-eyebrow/.test(out));
  assert.ok(!/Not medical advice/.test(out));
  assert.ok(!/How to read these insights/.test(out));
  assert.ok(!/Early pattern/.test(out));
  assert.ok(!/Based on \d+ observations/.test(out));
  assert.ok(!/Log sleep and energy on \d/.test(out));
  assert.ok(!/not proof|does not prove/.test(out));
});

test('empty patterns render one short line', () => {
  const { smartInsightsHTML } = renderContext();
  const out = smartInsightsHTML(predictedState(), currentState(), [], undefined, null, extras());

  assert.equal((out.match(/Log sleep and energy on/g) || []).length, 1);
  assert.ok(!/\d/.test((out.match(/Log sleep and energy[^<]*/) || [''])[0]), 'empty hint has no digits');
  assert.ok(!/\bundefined\b|\bNaN\b|<img|<script/i.test(out));
});

test('focus card shows the selected goal and switching chips when several goals exist', () => {
  const { smartInsightsHTML } = renderContext();
  const out = smartInsightsHTML(predictedState(), currentState(), [], 'Alex', null, extras());

  assert.match(out, /Your focus/);
  assert.match(out, /Better sleep is the goal you chose/);
  assert.match(out, /data-goal="Better sleep"/);
  assert.match(out, /data-goal="Understand my cycle"/);
  assert.match(out, /aria-pressed="true"/);
});

test('no goals shows the profile prompt', () => {
  const { smartInsightsHTML } = renderContext();
  const out = smartInsightsHTML(predictedState(), currentState(), [], undefined, null,
    extras({ noGoals: true, focusGoals: ['Understand my cycle'], selectedGoal: 'Understand my cycle', focus: null }));

  assert.match(out, /Pick your goals in Profile to personalize this\./);
});

test('section order follows the selected goal', () => {
  const { smartInsightsHTML } = renderContext();
  const sleep = smartInsightsHTML(predictedState(), currentState(), [], undefined, null, extras());
  const cycle = smartInsightsHTML(predictedState(), currentState(), [], undefined, null,
    extras({ selectedGoal: 'Understand my cycle' }));

  assert.ok(sleep.indexOf('This week vs last') < sleep.indexOf('Coming up'));
  assert.ok(cycle.indexOf('Coming up') < cycle.indexOf('This week vs last'));
});

test('week rows are compact and stress can show a good arrow', () => {
  const { smartInsightsHTML } = renderContext();
  const out = smartInsightsHTML(predictedState(), currentState(), [], undefined, null,
    extras({ week: [
      { key: 'energy', label: 'Energy', now: 3.4, prev: 2.9, arrow: '↑' },
      { key: 'stress', label: 'Stress', now: 2.1, prev: 3.4, arrow: '↓', good: true }
    ] }));

  assert.match(out, /Energy/);
  assert.match(out, /3\.4/);
  assert.match(out, /from 2\.9/);
  assert.match(out, /Stress/);
  assert.match(out, /↓/);
});

test('patterns show headline, detail and tip without badges or counts', () => {
  const { smartInsightsHTML } = renderContext();
  const patterns = [{
    type: 'stress-sleep',
    id: 'stress-sleep',
    headline: 'High-stress days = shorter sleep',
    detail: 'Stress 4-5: sleep 6.1h (4 days) vs stress 1-2: 7.6h (5 days)',
    tip: 'Wind down earlier on high-stress days.',
    count: 4,
    confidenceLevel: 'Early'
  }];
  const out = smartInsightsHTML(predictedState(), currentState(), patterns, 'Alex');

  assert.match(out, /High-stress days = shorter sleep/);
  assert.match(out, /6\.1h/);
  assert.match(out, /Wind down earlier on high-stress days\./);
  assert.ok(!/Early pattern/.test(out));
  assert.ok(!/Based on 4 observations/.test(out));
  assert.ok(!/Cloud AI explanation/.test(out));
});

test('only three patterns render', () => {
  const { smartInsightsHTML } = renderContext();
  const types = ['sleep-energy', 'mood-sleep', 'activity-energy', 'stress-sleep'];
  const patterns = types.map((t, i) => ({
    type: t,
    id: t,
    headline: 'Headline ' + i,
    detail: 'Detail ' + i,
    tip: 'Tip ' + i
  }));
  const out = smartInsightsHTML(predictedState(), currentState(), patterns);

  assert.match(out, /Headline 0/);
  assert.match(out, /Headline 2/);
  assert.ok(!/Headline 3/.test(out));
});

test('patterns render local headline and summary', () => {
  const { smartInsightsHTML } = renderContext();
  const patterns = [{ type: 'sleep-energy', id: 'p1', headline: 'Local headline', detail: 'Local detail', tip: 'Local tip' }];
  const out = smartInsightsHTML(predictedState(), currentState(), patterns, 'Alex', null);

  assert.match(out, /Local headline/);
  assert.match(out, /Local detail/);
  assert.match(out, /Local tip/);
});

test('user symptom names are escaped in patterns and coming up', () => {
  const { smartInsightsHTML } = renderContext();
  const patterns = [{
    type: 'symptom-phase',
    id: 's',
    headline: '<img src=x onerror=alert(1)>',
    detail: '<b>detail</b>',
    tip: '<i>tip</i>'
  }];
  const out = smartInsightsHTML(predictedState(), currentState(), patterns, undefined, null,
    extras({ comingUp: { daysToPeriod: 4, phases: [{ phase: 'Luteal', phaseLabel: 'Luteal', startsIn: 1, mood: null, energy: null, stress: null, symptoms: ['<img src=y>'] }] } }));

  assert.ok(!/<img src=x|<b>detail|<i>tip|<img src=y/.test(out));
  assert.match(out, /&lt;img src=x/);
  assert.match(out, /&lt;b&gt;detail/);
  assert.match(out, /&lt;img src=y/);
});

test('read-only mode hides the focus card but keeps the rest', () => {
  const { smartInsightsHTML } = renderContext();
  const out = smartInsightsHTML(predictedState(), currentState(), [], undefined, null,
    extras({ ro: true, focus: null }));

  assert.ok(!/Your focus/.test(out));
  assert.ok(!/Pick your goals/.test(out));
  assert.match(out, /This week vs last/);
  assert.match(out, /Coming up/);
});

test('cycle states keep plain messages', () => {
  const { smartInsightsHTML } = renderContext();
  const single = smartInsightsHTML({ state: 'single-start' }, currentState({ state: 'single-start' }), []);
  const future = smartInsightsHTML(predictedState(), currentState({ state: 'future-start' }), []);
  const overdue = smartInsightsHTML(predictedState(true), currentState({ state: 'overdue' }), []);

  assert.match(single, /Log at least 3 period start dates to see cycle estimates\./);
  assert.match(future, /last logged period start is in the future\. Please check the date\./);
  assert.match(overdue, /later than expected/);
});

test('Smart Insights has no Cloud AI controls or endpoint', () => {
  assert.equal(html.indexOf('function smartAIConsentHTML(){'), -1);
  assert.equal(html.indexOf('AI_ENDPOINT'), -1);
  assert.equal(html.indexOf('smartAIRefresh'), -1);
  assert.equal(html.indexOf('Make this more personal'), -1);
});

test('Settings no longer carries a medical disclaimer line', () => {
  assert.equal((html.match(/Bloom shows patterns from your logs\. It is not medical advice\./g) || []).length, 0);
  assert.ok(html.includes('<h3>App</h3>'));
});

test('clearLegacySmartAIStorage removes only obsolete AI keys and is safe on exceptions', () => {
  const mod = renderContext();
  mod.ST.set('bloom_ai_consent', '1');
  mod.ST.set('bloom_ai_cache', '{}');
  mod.ST.set('bloom_ai_token', 'tok');
  mod.ST.set('bloom_keep', 'value');
  mod.localStorage.setItem('bloom_ai_consent', '1');
  mod.localStorage.setItem('bloom_ai_cache', '{}');
  mod.localStorage.setItem('bloom_ai_token', 'tok');
  mod.localStorage.setItem('bloom_keep', 'ls-value');
  mod.clearLegacySmartAIStorage();
  assert.equal(mod.ST.get('bloom_ai_consent'), null);
  assert.equal(mod.ST.get('bloom_ai_cache'), null);
  assert.equal(mod.ST.get('bloom_ai_token'), null);
  assert.equal(mod.ST.get('bloom_keep'), 'value');
  assert.equal(mod.localStorage.getItem('bloom_ai_consent'), null);
  assert.equal(mod.localStorage.getItem('bloom_ai_cache'), null);
  assert.equal(mod.localStorage.getItem('bloom_ai_token'), null);
  assert.equal(mod.localStorage.getItem('bloom_keep'), 'ls-value');
  assert.doesNotThrow(() => mod.clearLegacySmartAIStorage());
  const throwing = renderContext();
  throwing.localStorage.removeItem = () => { throw new Error('blocked'); };
  throwing.ST.del = () => { throw new Error('blocked'); };
  assert.doesNotThrow(() => throwing.clearLegacySmartAIStorage());
});

test('logout executes cleanup and preserves unrelated preferences', () => {
  const mod = renderContext();
  mod.ST.set('bloom_ai_consent', '1'); mod.ST.set('bloom_ai_cache', '{}'); mod.ST.set('bloom_ai_token', 'tok');
  mod.localStorage.setItem('bloom_ai_consent', '1'); mod.localStorage.setItem('bloom_ai_cache', '{}'); mod.localStorage.setItem('bloom_ai_token', 'tok');
  mod.ST.set('bloom_own', '1'); mod.ST.set('bloom_theme', 'dark'); mod.localStorage.setItem('bloom_theme', 'dark');
  mod.RO = true; mod.user = { id: 'u' }; mod.view = 'log';
  mod.logout();
  assert.equal(mod.ST.get('bloom_ai_consent'), null);
  assert.equal(mod.ST.get('bloom_ai_cache'), null);
  assert.equal(mod.ST.get('bloom_ai_token'), null);
  assert.equal(mod.localStorage.getItem('bloom_ai_consent'), null);
  assert.equal(mod.localStorage.getItem('bloom_ai_cache'), null);
  assert.equal(mod.localStorage.getItem('bloom_ai_token'), null);
  assert.equal(mod.ST.get('bloom_own'), null);
  assert.equal(mod.ST.get('bloom_theme'), 'dark');
  assert.equal(mod.localStorage.getItem('bloom_theme'), 'dark');
});

test('full local deletion executes cleanup and preserves theme while removing local Bloom data', () => {
  const mod = renderContext();
  mod.ST.set('bloom_ai_consent', '1'); mod.ST.set('bloom_ai_cache', '{}'); mod.ST.set('bloom_ai_token', 'tok');
  mod.localStorage.setItem('bloom_ai_consent', '1'); mod.localStorage.setItem('bloom_ai_cache', '{}'); mod.localStorage.setItem('bloom_ai_token', 'tok');
  mod.localStorage.setItem('bloom_d_abc', '{}'); mod.localStorage.setItem('bloom_own', 'x'); mod.localStorage.setItem('bloom_theme', 'dark');
  mod.wipeLocalData();
  assert.equal(mod.localStorage.getItem('bloom_ai_consent'), null);
  assert.equal(mod.localStorage.getItem('bloom_ai_cache'), null);
  assert.equal(mod.localStorage.getItem('bloom_ai_token'), null);
  assert.equal(mod.localStorage.getItem('bloom_d_abc'), null);
  assert.equal(mod.localStorage.getItem('bloom_own'), null);
  assert.equal(mod.localStorage.getItem('bloom_theme'), 'dark');
});

test('logout and full deletion tolerate cleanup/storage exceptions', () => {
  const mod = renderContext();
  mod.localStorage.removeItem = () => { throw new Error('nope'); };
  mod.ST.del = () => { throw new Error('nope'); };
  assert.doesNotThrow(() => mod.logout());
  const mod2 = renderContext();
  mod2.localStorage.removeItem = () => { throw new Error('nope'); };
  assert.doesNotThrow(() => mod2.wipeLocalData());
});

test('all seven goal CTA mappings are real and meaningful', () => {
  const { smartCTAFor, smartCTALabel } = renderContext();
  const goals = ['Understand my cycle','Steadier energy','Better sleep','Move more','Eat regularly','Manage stress','Prepare for doctor visits'];
  goals.forEach(g => {
    const action = smartCTAFor(g);
    const label = smartCTALabel(g);
    assert.ok(['log','meals','journal','export'].includes(action), g);
    assert.ok(label.length > 5, g);
    assert.ok(!/\d/.test(label), g);
  });
  assert.equal(smartCTAFor('Eat regularly'), 'meals');
  assert.equal(smartCTAFor('Manage stress'), 'journal');
  assert.equal(smartCTAFor('Prepare for doctor visits'), 'export');
});



test('Smart Insights deduplicates primary sleep evidence across sections', () => {
  const { smartInsightsHTML } = renderContext();
  const out = smartInsightsHTML(
    { state: 'predicted', startCount: 4, validCount: 3, last: '2026-03-26', expected: '2026-04-23', rangeStart: '2026-04-20', rangeEnd: '2026-04-30', min: 25, max: 35, avg: 28, overdue: false, confidence: 'Limited history' },
    { state: 'due-today', phase: null, phaseLabel: null, cycleDay: null, cycleLength: null, confidence: 'Limited history', predictedDate: '2026-04-23' },
    [],
    'Alex',
    null,
    {
      selectedGoal: 'Better sleep',
      focusGoals: ['Better sleep'],
      noGoals: false,
      focus: { goal: 'Better sleep', headline: 'Sleep 6.8 h last week', metric: '6.8 h (3 under 7h)', trend: 'sleep 6.8 vs 7.2 h', action: 'Try a consistent wind-down time.' },
      week: [{ key: 'sleep', label: 'Sleep', now: 6.8, prev: 7.2, arrow: '↓' }, { key: 'energy', label: 'Energy', now: 3.4, prev: 2.9, arrow: '↑' }],
      comingUp: { daysToPeriod: 10, phases: [{ phase: 'Luteal', phaseLabel: 'Luteal phase', startsIn: 3, mood: 3.2, energy: 2.8, stress: 3.5, symptoms: ['Headache', 'Cramps'] }] },
      weekCard: { headline: 'Sleep down this week', summary: 'Sleep averaged 6.8 h this week, decreased from 7.2.', actions: ['Try an earlier bedtime', 'Plan a short walk'] },
      weekFacts: { goals: ['Better sleep'], week: [{ label: 'Sleep', now: 6.8, prev: 7.2 }, { label: 'Energy', now: 3.4, prev: 2.9 }], comingUp: [], focus: { headline: 'Sleep 6.8 h last week', metric: '6.8 h (3 under 7h)', trend: 'sleep 6.8 vs 7.2 h' }, daysToPeriod: 10, phaseLabel: 'Luteal phase', cycleDay: 18 },
      ro: false
    }
  );
  const sleepMetricOccurrences = (out.match(/6\.8 h/g) || []).length;
  assert.ok(sleepMetricOccurrences <= 1, 'sleep metric should not repeat');
  assert.match(out, /Your focus/);
});



test('evidence registry tracks ownership and prevents duplicate claims across sections', () => {
  const { smartEvidenceRegistry } = renderContext();
  const reg = smartEvidenceRegistry();
  assert.equal(reg.claim('metric:Sleep:window:7d','Your week','metric-week'), true);
  assert.equal(reg.claim('metric:Sleep:window:7d','Week comparison','metric-week'), false);
  assert.equal(reg.has('metric:Sleep:window:7d'), true);
  assert.equal(reg.owner('metric:Sleep:window:7d'), 'Your week');
  const e = reg.get('metric:Sleep:window:7d');
  assert.equal(e.type, 'metric-week');
  assert.equal(e.presented, true);
  assert.equal(reg.claim('metric:Energy:window:7d','Week comparison','metric-week'), true);
  assert.equal(reg.entries().length, 2);
});

test('registry resets between renders and render order does not duplicate findings', () => {
  const { smartInsightsHTML } = renderContext();
  const base = (orderGoal) => ({
    selectedGoal: orderGoal,
    focusGoals: ['Better sleep', 'Understand my cycle'],
    noGoals: false,
    focus: { goal: orderGoal, headline: 'Sleep 6.4 h last week', metric: '6.4 h (3 under 7h)', trend: 'sleep 6.4 vs 7.6 h', action: 'Try a consistent wind-down time.' },
    week: [{ key: 'sleep', label: 'Sleep', now: 6.4, prev: 7.6, arrow: '↓' }, { key: 'energy', label: 'Energy', now: 3.2, prev: 2.8, arrow: '↑' }],
    comingUp: { daysToPeriod: 10, phases: [{ phase: 'Luteal', phaseLabel: 'Luteal phase', startsIn: 3, mood: 3.2, energy: 2.8, stress: 3.5, symptoms: ['Headache'] }] },
    weekCard: { headline: 'Sleep decreased this week', summary: 'Sleep averaged 6.4 h this week, decreased from 7.6.', actions: ['Try an earlier bedtime', 'Plan a short walk'] },
    weekFacts: { goals: ['Better sleep'], week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Energy', now: 3.2, prev: 2.8 }], comingUp: [{ phaseLabel: 'Luteal phase', startsIn: 3, mood: 3.2, energy: 2.8, stress: 3.5, symptoms: ['Headache'] }], focus: { headline: 'Sleep 6.4 h last week', metric: '6.4 h (3 under 7h)', trend: 'sleep 6.4 vs 7.6 h' }, daysToPeriod: 10, phaseLabel: 'Luteal phase', cycleDay: 18 },
    ro: false
  });
  const a = smartInsightsHTML(predictedState(), currentState(), [], 'Alex', null, base('Better sleep'));
  const b = smartInsightsHTML(predictedState(), currentState(), [], 'Alex', null, base('Understand my cycle'));
  // sleep metric appears in Your week summary but should not repeat in comparison section
  assert.equal((a.match(/Sleep<\/span><span class="smart-week-val">6\.4/g)||[]).length, 0);
  assert.equal((b.match(/Sleep<\/span><span class="smart-week-val">6\.4/g)||[]).length, 0);
  // energy remains in comparison (distinct evidence)
  assert.match(a, /Energy/);
  // fresh render: calling again yields same structure (no accumulation)
  const c = smartInsightsHTML(predictedState(), currentState(), [], 'Alex', null, base('Better sleep'));
  assert.equal((c.match(/Sleep<\/span><span class="smart-week-val">6\.4/g)||[]).length, 0);
});

test('period evidence in summary suppresses duplicate period in Coming up but keeps distinct upcoming phase', () => {
  const { smartInsightsHTML } = renderContext();
  const out = smartInsightsHTML(predictedState(), currentState(), [], 'Alex', null, {
    selectedGoal: 'Understand my cycle',
    focusGoals: ['Understand my cycle'],
    noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: null, action: 'Follicular phase starts in 2 days.' },
    week: [],
    comingUp: { daysToPeriod: 4, phases: [{ phase: 'Follicular', phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: [] }] },
    weekCard: { headline: 'Day 18 of cycle', summary: 'Day 18 in Luteal phase, period in 4 days.', actions: ['Note symptoms as they show up', 'Plan a short walk'] },
    weekFacts: { goals: ['Understand my cycle'], week: [], comingUp: [{ phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: [] }], focus: { headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: '' }, daysToPeriod: 4, phaseLabel: 'Luteal phase', cycleDay: 18 },
    ro: false
  });
  assert.match(out, /Follicular phase/);
  // period expected should appear once total? summary has "period in 4 days" and coming up tail would say "Period expected in 4 days." - dedup should remove tail
  assert.equal((out.match(/Period expected in 4 days\./g)||[]).length, 0);
  assert.match(out, /before your period/);
});




test('Fix1: week data does not claim ownership unless Your week presents it; different goal resets ownership', () => {
  const { smartInsightsHTML } = renderContext();
  // Manage stress selected, Your week presents sleep (different evidence) -> stress focus must still render
  const out = smartInsightsHTML(predictedState(), currentState(), [], 'Alex', null, {
    selectedGoal: 'Manage stress',
    focusGoals: ['Manage stress','Better sleep'],
    noGoals: false,
    focus: { goal: 'Manage stress', headline: 'Stress 3.8/5 last week', metric: '3.8/5 · 2 high days', trend: '3.8 vs 2.4 before', action: 'Protect one small routine on high-stress days.' },
    week: [{ key: 'sleep', label: 'Sleep', now: 6.4, prev: 7.6, arrow: '↓' }, { key: 'stress', label: 'Stress', now: 3.8, prev: 2.4, arrow: '↑' }],
    comingUp: null,
    weekCard: { headline: 'Sleep decreased this week', summary: 'Sleep averaged 6.4 h this week, decreased from 7.6.', actions: ['Try an earlier bedtime', 'Protect one small routine'] },
    weekFacts: { goals: ['Better sleep'], week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Stress', now: 3.8, prev: 2.4 }], comingUp: [], focus: { headline: 'Sleep 6.4 h last week', metric: '6.4 h', trend: 'sleep 6.4 vs 7.6 h' }, daysToPeriod: 10, phaseLabel: 'Luteal phase', cycleDay: 18 },
    ro: false
  });
  // Stress presented by focus (not Your week) must still render; focus owns it so comparison does not duplicate
  assert.match(out, /One small routine, kept on the hard days/);
  assert.equal((out.match(/Stress<\/span><span class="smart-week-val">3\.8/g)||[]).length, 0);

  // selected Better sleep and Your week presents sleep -> duplicate suppressed in comparison/focus metric
  const out2 = smartInsightsHTML(predictedState(), currentState(), [], 'Alex', null, {
    selectedGoal: 'Better sleep',
    focusGoals: ['Better sleep'],
    noGoals: false,
    focus: { goal: 'Better sleep', headline: 'Sleep 6.4 h last week', metric: '6.4 h (3 under 7h)', trend: 'sleep 6.4 vs 7.6 h', action: 'Try a consistent wind-down time.' },
    week: [{ key: 'sleep', label: 'Sleep', now: 6.4, prev: 7.6, arrow: '↓' }, { key: 'energy', label: 'Energy', now: 3.2, prev: 2.8, arrow: '↑' }],
    comingUp: null,
    weekCard: { headline: 'Sleep decreased this week', summary: 'Sleep averaged 6.4 h this week, decreased from 7.6.', actions: ['Try an earlier bedtime', 'Plan a short walk'] },
    weekFacts: { goals: ['Better sleep'], week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Energy', now: 3.2, prev: 2.8 }], comingUp: [], focus: { headline: 'Sleep 6.4 h last week', metric: '6.4 h (3 under 7h)', trend: 'sleep 6.4 vs 7.6 h' }, daysToPeriod: 10, phaseLabel: 'Luteal phase', cycleDay: 18 },
    ro: false
  });
  assert.equal((out2.match(/Sleep<\/span><span class="smart-week-val">6\.4/g)||[]).length, 0);

  // weekly data contains Stress but summary does not present it -> Stress not claimed by Your week
  const out3 = smartInsightsHTML(predictedState(), currentState(), [], 'Alex', null, {
    selectedGoal: 'Understand my cycle',
    focusGoals: ['Understand my cycle'],
    noGoals: false,
    focus: null,
    week: [{ key: 'stress', label: 'Stress', now: 3.8, prev: 2.4, arrow: '↑' }],
    comingUp: null,
    weekCard: { headline: 'Day 18 of cycle', summary: 'Day 18 in Luteal phase, period in 10 days.', actions: ['Note symptoms as they show up', 'Plan a short walk'] },
    weekFacts: { goals: ['Understand my cycle'], week: [{ label: 'Stress', now: 3.8, prev: 2.4 }], comingUp: [], focus: { headline: 'Day 18 of ~28 · Luteal phase', metric: '', trend: '' }, daysToPeriod: 10, phaseLabel: 'Luteal phase', cycleDay: 18 },
    ro: false
  });
  assert.match(out3, /Stress<\/span>/);

  // re-render with different selected goal resets ownership (fresh registry)
  const out4 = smartInsightsHTML(predictedState(), currentState(), [], 'Alex', null, {
    selectedGoal: 'Manage stress',
    focusGoals: ['Manage stress','Better sleep'],
    noGoals: false,
    focus: { goal: 'Manage stress', headline: 'Stress 3.8/5 last week', metric: '3.8/5 · 2 high days', trend: '3.8 vs 2.4 before', action: 'Protect one small routine on high-stress days.' },
    week: [{ key: 'sleep', label: 'Sleep', now: 6.4, prev: 7.6, arrow: '↓' }, { key: 'stress', label: 'Stress', now: 3.8, prev: 2.4, arrow: '↑' }],
    comingUp: null,
    weekCard: { headline: 'Stress increased this week', summary: 'Stress averaged 3.8 this week, increased from 2.4.', actions: ['Protect one small routine', 'Try an earlier bedtime'] },
    weekFacts: { goals: ['Manage stress'], week: [{ label: 'Sleep', now: 6.4, prev: 7.6 }, { label: 'Stress', now: 3.8, prev: 2.4 }], comingUp: [], focus: { headline: 'Stress 3.8/5 last week', metric: '3.8/5', trend: '3.8 vs 2.4 before' }, daysToPeriod: 10, phaseLabel: 'Luteal phase', cycleDay: 18 },
    ro: false
  });
  assert.match(out4, /Stress pressed higher/);
  assert.equal((out4.match(/Stress<\/span><span class="smart-week-val">3\.8/g)||[]).length, 0);
});

test('Fix2: Cycle period estimate claimed and suppressed in Coming up; period-only Coming up renders', () => {
  const { smartInsightsHTML, smartComingUpHTML, smartEvidenceRegistry } = renderContext();
  const pred = predictedState(false);
  const current = { state: 'estimated', phase: 'Luteal', phaseLabel: 'Luteal phase', cycleDay: 18, cycleLength: 28, confidence: 'Limited history', predictedDate: '2026-04-23' };
  // Cycle displays estimate -> Coming up no duplicate period tail
  const out = smartInsightsHTML(pred, current, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false, focus: null, week: [], ro: false,
    comingUp: { daysToPeriod: 4, phases: [{ phase: 'Follicular', phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: [] }] },
    weekCard: null, weekFacts: null
  });
  assert.match(out, /Next period/);
  assert.equal((out.match(/Period expected in 4 days\./g)||[]).length, 0);
  assert.match(out, /Follicular phase/);

  // Cycle no period estimate -> Coming up can display it
  const predNo = { state: 'limited-history', startCount: 2, validCount: 1, last: '2026-03-26', expected: null, rangeStart: null, rangeEnd: null, min: null, max: null, avg: null, overdue: false, confidence: 'Limited history' };
  const curNo = { state: 'single-start', phase: null, phaseLabel: null, cycleDay: null, cycleLength: null, confidence: 'Limited history', predictedDate: null };
  const out2 = smartInsightsHTML(predNo, curNo, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false, focus: null, week: [], ro: false,
    comingUp: { daysToPeriod: 4, phases: [] }, weekCard: null, weekFacts: null
  });
  assert.match(out2, /Period expected in 4 days\./);

  // no phases + valid period -> period renders
  assert.match(smartComingUpHTML({ daysToPeriod: 4, phases: [] }), /Period expected in 4 days\./);
  // phases + no period -> phases render
  assert.match(smartComingUpHTML({ phases: [{ phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: [] }] }), /Follicular phase/);
  // invalid period + no phases -> nothing fabricated
  assert.equal(smartComingUpHTML({ daysToPeriod: -1, phases: [] }), '');
  assert.equal(smartComingUpHTML({ daysToPeriod: 0, phases: [] }), '');
});

test('Fix3: Focus association evidence suppresses same association in Patterns; different associations remain', () => {
  const { smartInsightsHTML } = renderContext();
  const sleepEnergy = { type: 'sleep-energy', id: 'sleep-energy', headline: 'Short sleep days = lower energy', detail: 'Under 7h: energy 2.0/5 (3 days) vs 7h+: 4.0/5 (3 days)', tip: 'Try an earlier bedtime on busy days.' };
  const stressSleep = { type: 'stress-sleep', id: 'stress-sleep', headline: 'Sleep averages were lower on days with higher recorded stress.', detail: 'Stress 4-5: sleep 6.0h (3 days) vs stress 1-2: 7.5h (3 days)', tip: 'Wind down earlier on high-stress days.' };
  // Focus displays sleep-energy association -> Patterns suppresses it
  const out = smartInsightsHTML(predictedState(), currentState(), [sleepEnergy, stressSleep], 'Alex', null, {
    selectedGoal: 'Better sleep', focusGoals: ['Better sleep'], noGoals: false,
    focus: { goal: 'Better sleep', headline: 'Sleep 6.4 h last week', metric: '6.4 h', trend: null, action: 'Under 7h: energy 2.0/5 (3 days) vs 7h+: 4.0/5 (3 days)', evidenceId: 'association:sleep-energy:all' },
    week: [], comingUp: null, weekCard: null, weekFacts: null, ro: false
  });
  assert.equal((out.match(/Short sleep days = lower energy/g)||[]).length, 0);
  assert.match(out, /Sleep averages were lower on days with higher recorded stress/);

  // No association in focus -> Patterns can display it
  const out2 = smartInsightsHTML(predictedState(), currentState(), [sleepEnergy], 'Alex', null, {
    selectedGoal: 'Better sleep', focusGoals: ['Better sleep'], noGoals: false,
    focus: { goal: 'Better sleep', headline: 'Sleep 6.4 h last week', metric: '6.4 h', trend: null, action: 'Try a consistent wind-down time.' },
    week: [], comingUp: null, weekCard: null, weekFacts: null, ro: false
  });
  assert.match(out2, /Short sleep days = lower energy/);

  // Different associations involving Sleep remain independently eligible (sleep-energy vs mood-sleep)
  const moodSleep = { type: 'mood-sleep', id: 'mood-sleep', headline: 'Better mood days = more sleep', detail: 'Mood 4-5: sleep 7.8h (3 days) vs mood 1-2: 6.5h (3 days)', tip: 'Protect your usual bedtime on low-mood days.' };
  const out3 = smartInsightsHTML(predictedState(), currentState(), [sleepEnergy, moodSleep], 'Alex', null, {
    selectedGoal: 'Better sleep', focusGoals: ['Better sleep'], noGoals: false,
    focus: { goal: 'Better sleep', headline: 'Sleep 6.4 h last week', metric: '6.4 h', trend: null, action: 'Under 7h: energy 2.0/5 (3 days) vs 7h+: 4.0/5 (3 days)', evidenceId: 'association:sleep-energy:all' },
    week: [], comingUp: null, weekCard: null, weekFacts: null, ro: false
  });
  assert.equal((out3.match(/Short sleep days = lower energy/g)||[]).length, 0);
  assert.match(out3, /Better mood days = more sleep/);
});




test('Period deduplication: Your week suppresses Cycle and Coming up; distinct phase remains; registry resets', () => {
  const { smartInsightsHTML } = renderContext();
  const pred = predictedState(false);
  const current = { state: 'estimated', phase: 'Luteal', phaseLabel: 'Luteal phase', cycleDay: 18, cycleLength: 28, confidence: 'Limited history', predictedDate: '2026-04-23' };
  const extras = {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: null, action: 'Keep logging.' },
    week: [], ro: false,
    comingUp: { daysToPeriod: 4, phases: [{ phase: 'Follicular', phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: [] }] },
    weekCard: { headline: 'Day 18 of cycle', summary: 'Day 18 in Luteal phase, period in 4 days.', actions: ['Note symptoms as they show up', 'Plan a short walk'] },
    weekFacts: { goals: ['Understand my cycle'], week: [], comingUp: [{ phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: [] }], focus: { headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: '' }, daysToPeriod: 4, phaseLabel: 'Luteal phase', cycleDay: 18 }
  };
  const out = smartInsightsHTML(pred, current, [], 'Alex', null, extras);
  assert.match(out, /before your period/); // Your week presents it
  assert.ok(!/Next period/.test(out), 'Cycle should not repeat period estimate when Your week owns it');
  assert.equal((out.match(/Period expected in 4 days\./g)||[]).length, 0, 'Coming up period tail suppressed');
  assert.match(out, /Follicular phase/, 'distinct upcoming phase remains');

  // Cycle suppresses Coming up when Your week does not present period
  const out2 = smartInsightsHTML(pred, current, [], 'Alex', null, {
    selectedGoal: 'Better sleep', focusGoals: ['Better sleep'], noGoals: false,
    focus: { goal: 'Better sleep', headline: 'Sleep 6.4 h last week', metric: '6.4 h', trend: null, action: 'Try a consistent wind-down time.' },
    week: [], ro: false, weekCard: null, weekFacts: null,
    comingUp: { daysToPeriod: 4, phases: [{ phase: 'Follicular', phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: [] }] }
  });
  assert.match(out2, /Next period/);
  assert.equal((out2.match(/Period expected in 4 days\./g)||[]).length, 0);
  assert.match(out2, /Follicular phase/);

  // Coming up displays period when neither earlier section renders it
  const predNo = { state: 'limited-history', expected: null };
  const curNo = { state: 'single-start', phase: null, phaseLabel: null, cycleDay: null, cycleLength: null, confidence: 'Limited history', predictedDate: null };
  const out3 = smartInsightsHTML(predNo, curNo, [], 'Alex', null, {
    selectedGoal: 'Better sleep', focusGoals: ['Better sleep'], noGoals: false, focus: null, week: [], ro: false, weekCard: null, weekFacts: null,
    comingUp: { daysToPeriod: 4, phases: [] }
  });
  assert.ok(!/Next period/.test(out3));
  assert.match(out3, /Period expected in 4 days\./);

  // Registry resets on new render
  const out4 = smartInsightsHTML(predNo, curNo, [], 'Alex', null, {
    selectedGoal: 'Better sleep', focusGoals: ['Better sleep'], noGoals: false, focus: null, week: [], ro: false, weekCard: null, weekFacts: null,
    comingUp: { daysToPeriod: 4, phases: [] }
  });
  assert.match(out4, /Period expected in 4 days\./);
});

test('Stress/sleep identity: actual focus outputs use specific IDs and do not incorrectly suppress different pattern evidence', () => {
  const mod = renderContext();
  const { smartGoalFocus, smartPatternsFromLogs, smartInsightsHTML } = mod;
  const TODAY = '2026-01-20';

  // Poor sleep quality on high-stress days (focus) vs sleep duration on high-stress vs low-stress days (pattern) - different evidence
  const logsQuality = {
    '2026-01-14': { stress: 4, sleep: 8, sleepq: 1 },
    '2026-01-15': { stress: 5, sleep: 8, sleepq: 2 },
    '2026-01-16': { stress: 4, sleep: 7.5, sleepq: 2 },
    '2026-01-09': { stress: 2, sleep: 8, sleepq: 4 },
    '2026-01-10': { stress: 2, sleep: 8, sleepq: 4 },
    '2026-01-11': { stress: 2, sleep: 8, sleepq: 4 }
  };
  // construct logs that also produce stress-sleep duration pattern (high stress shorter sleep than low stress)
  const logsBoth = {
    '2026-01-14': { stress: 5, sleep: 5.5, sleepq: 1 },
    '2026-01-15': { stress: 4, sleep: 5.8, sleepq: 2 },
    '2026-01-16': { stress: 5, sleep: 6.0, sleepq: 2 },
    '2026-01-09': { stress: 1, sleep: 7.8, sleepq: 4 },
    '2026-01-10': { stress: 2, sleep: 7.5, sleepq: 4 },
    '2026-01-11': { stress: 1, sleep: 8.0, sleepq: 4 }
  };
  const focusQ = smartGoalFocus('Manage stress', { logs: logsQuality, startDates: [], current: { state: 'no-history' }, pred: {}, todayStr: TODAY, meals: {} });
  assert.equal(focusQ.evidenceId, 'association:stress-poor-sleep-quality:focus-14d');
  const patsBoth = smartPatternsFromLogs(logsBoth, []);
  const stressPat = patsBoth.find(p => p.type === 'stress-sleep');
  assert.ok(stressPat, 'stress-sleep duration pattern exists');
  // poor sleep quality focus must not suppress stress-sleep duration pattern
  const out1 = smartInsightsHTML(predictedState(), currentState(), patsBoth, 'Alex', null, {
    selectedGoal: 'Manage stress', focusGoals: ['Manage stress'], noGoals: false, focus: focusQ, week: [], comingUp: null, weekCard: null, weekFacts: null, ro: false
  });
  assert.match(out1, /Sleep averages were lower on days with higher recorded stress/);

  // Short sleep companion in stress focus is different evidence than pattern's high-vs-low stress sleep duration comparison
  const focusShort = smartGoalFocus('Manage stress', { logs: logsBoth, startDates: [], current: { state: 'no-history' }, pred: {}, todayStr: TODAY, meals: {} });
  // focusShort may pick short or quality depending on counts; ensure short case
  if (focusShort.evidenceId === 'association:stress-short-sleep:focus-14d') {
    const out2 = smartInsightsHTML(predictedState(), currentState(), patsBoth, 'Alex', null, {
      selectedGoal: 'Manage stress', focusGoals: ['Manage stress'], noGoals: false, focus: focusShort, week: [], comingUp: null, weekCard: null, weekFacts: null, ro: false
    });
    assert.match(out2, /Sleep averages were lower on days with higher recorded stress/, 'different stress/sleep evidence remains eligible');
  }

  // Sleep-energy duplicate still suppressed when genuinely identical (focus uses pattern detail with association:sleep-energy:all)
  const logsSE = {
    '2026-01-14': { sleep: 5.5, energy: 2 }, '2026-01-15': { sleep: 5.8, energy: 2 }, '2026-01-16': { sleep: 6.0, energy: 2 },
    '2026-01-17': { sleep: 7.8, energy: 4 }, '2026-01-18': { sleep: 7.5, energy: 4 }, '2026-01-19': { sleep: 8.0, energy: 4 }
  };
  const focusSE = smartGoalFocus('Better sleep', { logs: logsSE, startDates: [], current: { state: 'no-history' }, pred: {}, todayStr: TODAY, meals: {} });
  const patsSE = smartPatternsFromLogs(logsSE, []);
  const sePat = patsSE.find(p => p.type === 'sleep-energy');
  assert.ok(focusSE.evidenceId === 'association:sleep-energy:all' && sePat);
  const outSE = smartInsightsHTML(predictedState(), currentState(), patsSE, 'Alex', null, {
    selectedGoal: 'Better sleep', focusGoals: ['Better sleep'], noGoals: false, focus: focusSE, week: [], comingUp: null, weekCard: null, weekFacts: null, ro: false
  });
  assert.equal((outSE.match(/Short sleep days = lower energy/g)||[]).length, 0);

  // Registry resets between renders
  const outR1 = smartInsightsHTML(predictedState(), currentState(), patsSE, 'Alex', null, { selectedGoal: 'Better sleep', focusGoals: ['Better sleep'], noGoals: false, focus: null, week: [], comingUp: null, weekCard: null, weekFacts: null, ro: false });
  const outR2 = smartInsightsHTML(predictedState(), currentState(), patsSE, 'Alex', null, { selectedGoal: 'Better sleep', focusGoals: ['Better sleep'], noGoals: false, focus: null, week: [], comingUp: null, weekCard: null, weekFacts: null, ro: false });
  assert.match(outR1, /Short sleep days = lower energy/);
  assert.match(outR2, /Short sleep days = lower energy/);
});




test('Focus period metric suppresses Cycle and Coming up duplicates; distinct phase remains; read-only does not claim hidden focus', () => {
  const { smartInsightsHTML } = renderContext();
  const pred = predictedState(false);
  const current = { state: 'estimated', phase: 'Luteal', phaseLabel: 'Luteal phase', cycleDay: 18, cycleLength: 28, confidence: 'Limited history', predictedDate: '2026-04-23' };
  // Focus period metric suppresses Cycle and Coming up duplicates
  const out = smartInsightsHTML(pred, current, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: null, action: 'Keep logging.' },
    week: [], ro: false, weekCard: null, weekFacts: null,
    comingUp: { daysToPeriod: 4, phases: [{ phase: 'Follicular', phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: [] }] }
  });
  assert.match(out, /your period is close enough/); // focus period in plain words
  assert.ok(!/Next period/.test(out), 'Cycle should not repeat period estimate');
  assert.equal((out.match(/Period expected in 4 days\./g)||[]).length, 0, 'Coming up period tail suppressed');
  assert.match(out, /Follicular phase/, 'distinct upcoming phase remains');
  assert.match(out, /Understanding your cycle is the goal/, 'focus prose preserved');

  // Focus without a period metric allows Cycle to render its estimate
  const out2 = smartInsightsHTML(pred, current, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: null, trend: null, action: 'Keep logging.' },
    week: [], ro: false, weekCard: null, weekFacts: null,
    comingUp: { daysToPeriod: 4, phases: [] }
  });
  assert.match(out2, /Next period/);
  assert.equal((out2.match(/Period expected in 4 days\./g)||[]).length, 0);

  // Focus without period metric and Cycle without estimate allows Coming up to render its period
  const predNo = { state: 'limited-history', expected: null };
  const curNo = { state: 'single-start', phase: null, phaseLabel: null, cycleDay: null, cycleLength: null, confidence: 'Limited history', predictedDate: null };
  const out3 = smartInsightsHTML(predNo, curNo, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Log period start dates to see this', metric: null, trend: null, action: null },
    week: [], ro: false, weekCard: null, weekFacts: null,
    comingUp: { daysToPeriod: 4, phases: [] }
  });
  assert.ok(!/Next period/.test(out3));
  assert.match(out3, /Period expected in 4 days\./);

  // Read-only mode does not claim hidden focus evidence
  const out4 = smartInsightsHTML(pred, current, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: null, action: 'Keep logging.' },
    week: [], ro: true, weekCard: null, weekFacts: null,
    comingUp: { daysToPeriod: 4, phases: [] }
  });
  assert.ok(!/Your focus/.test(out4));
  assert.match(out4, /Next period/, 'hidden focus must not suppress Cycle period');
});




test('Period ownership: Your week owns period, Focus suppresses only duplicate period metric (headline/action/phase preserved)', () => {
  const { smartInsightsHTML } = renderContext();
  const pred = predictedState(false);
  const current = { state: 'estimated', phase: 'Luteal', phaseLabel: 'Luteal phase', cycleDay: 18, cycleLength: 28, confidence: 'Limited history', predictedDate: '2026-04-23' };
  const out = smartInsightsHTML(pred, current, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: null, action: 'Keep logging.' },
    week: [], ro: false,
    weekCard: { headline: 'Your week', summary: 'Period in 4 days.', actions: ['Note symptoms as they show up', 'Plan a short walk'] },
    weekFacts: { goals: ['Understand my cycle'], week: [], comingUp: [{ phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: [] }], focus: { headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: '' }, daysToPeriod: 4 },
    comingUp: { daysToPeriod: 4, phases: [{ phase: 'Follicular', phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: [] }] }
  });
  assert.match(out, /Your week/);
  assert.match(out, /before your period/);
  const focusSection = (out.match(/<section class="smart-section smart-focus"[\s\S]*?<\/section>/) || [''])[0];
  assert.ok(focusSection, 'focus section rendered');
  assert.ok(!/Period expected in 4 days/.test(focusSection), 'Focus must not display duplicate period metric');
  assert.ok(!/Next period/.test(out), 'Cycle must not display duplicate period estimate');
  assert.equal((out.match(/Period expected in 4 days\./g) || []).length, 0, 'Coming up must not display duplicate period estimate');
  assert.match(out, /Follicular phase/);
  assert.match(focusSection, /Understanding your cycle is the goal/, 'Focus keeps its plain-language frame');
  assert.match(focusSection, /Keep noting how you feel each day/, 'Focus advice remains visible');
});

test('Period ownership: Your week owns period and cycle-day/phase, Focus suppresses duplicated headline and metric', () => {
  const { smartInsightsHTML } = renderContext();
  const pred = predictedState(false);
  const current = { state: 'estimated', phase: 'Luteal', phaseLabel: 'Luteal phase', cycleDay: 18, cycleLength: 28, confidence: 'Limited history', predictedDate: '2026-04-23' };
  const out = smartInsightsHTML(pred, current, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: null, action: 'Keep logging.' },
    week: [], ro: false,
    weekCard: { headline: 'Day 18 of cycle', summary: 'Day 18 in Luteal phase, period in 4 days.', actions: ['Note symptoms as they show up', 'Plan a short walk'] },
    weekFacts: { goals: ['Understand my cycle'], week: [], comingUp: [], focus: { headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: '' }, daysToPeriod: 4, phaseLabel: 'Luteal phase', cycleDay: 18 },
    comingUp: { daysToPeriod: 4, phases: [{ phase: 'Follicular', phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: [] }] }
  });
  assert.match(out, /Your week/);
  const focusSection = (out.match(/<section class="smart-section smart-focus"[\s\S]*?<\/section>/) || [''])[0];
  assert.ok(focusSection);
  assert.ok(!/Period expected in 4 days/.test(focusSection));
  assert.ok(!/Day 18 of ~28 · Luteal phase/.test(focusSection), 'Focus must not repeat already-owned cycle-day/phase headline');
  assert.ok(!/Next period/.test(out));
  assert.equal((out.match(/Period expected in 4 days\./g) || []).length, 0);
  assert.match(out, /Follicular phase/);
  assert.match(focusSection, /Keep noting how you feel each day/, 'Focus advice remains');
});

test('Period ownership: Focus owns period when Your week does not; Cycle/Coming up do not duplicate', () => {
  const { smartInsightsHTML } = renderContext();
  const pred = predictedState(false);
  const current = { state: 'estimated', phase: 'Luteal', phaseLabel: 'Luteal phase', cycleDay: 18, cycleLength: 28, confidence: 'Limited history', predictedDate: '2026-04-23' };
  const out = smartInsightsHTML(pred, current, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: null, action: 'Keep logging.' },
    week: [], ro: false, weekCard: null, weekFacts: null,
    comingUp: { daysToPeriod: 4, phases: [{ phase: 'Follicular', phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: [] }] }
  });
  const focusSection = (out.match(/<section class="smart-section smart-focus"[\s\S]*?<\/section>/) || [''])[0];
  assert.ok(focusSection && /your period is close enough/.test(focusSection), 'Focus displays its period in plain words');
  assert.ok(!/Next period/.test(out), 'Cycle must not duplicate');
  assert.equal((out.match(/Period expected in 4 days\./g) || []).length, 0, 'Coming up must not duplicate');
  assert.match(out, /Follicular phase/);
});

test('Period ownership: invalid/missing Focus period estimate must not claim and must not suppress valid evidence', () => {
  const { smartInsightsHTML } = renderContext();
  const pred = predictedState(false);
  const current = { state: 'estimated', phase: 'Luteal', phaseLabel: 'Luteal phase', cycleDay: 18, cycleLength: 28, confidence: 'Limited history', predictedDate: '2026-04-23' };
  const predNo = { state: 'limited-history', expected: null };
  const curNo = { state: 'single-start', phase: null, phaseLabel: null, cycleDay: null, cycleLength: null, confidence: 'Limited history', predictedDate: null };
  const base = (focus, comingUp, p = pred, c = current) => smartInsightsHTML(p, c, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus, week: [], ro: false, weekCard: null, weekFacts: null, comingUp
  });
  const cases = [
    { focus: { goal: 'Understand my cycle', headline: 'H', metric: null, trend: null, action: 'A' }, comingUp: { daysToPeriod: 4, phases: [] } },
    { focus: { goal: 'Understand my cycle', headline: 'H', metric: '', trend: null, action: 'A' }, comingUp: { daysToPeriod: 4, phases: [] } },
    { focus: { goal: 'Understand my cycle', headline: 'H', metric: '   ', trend: null, action: 'A' }, comingUp: { daysToPeriod: 4, phases: [] } },
    { focus: { goal: 'Understand my cycle', headline: 'H', metric: 'Period expected in 4 days', trend: null, action: 'A' }, comingUp: null },
    { focus: { goal: 'Understand my cycle', headline: 'H', metric: 'Period expected in 4 days', trend: null, action: 'A' }, comingUp: { daysToPeriod: null, phases: [] } },
    { focus: { goal: 'Understand my cycle', headline: 'H', metric: 'Period expected in 4 days', trend: null, action: 'A' }, comingUp: { daysToPeriod: 0, phases: [] } },
    { focus: { goal: 'Understand my cycle', headline: 'H', metric: 'Period expected in 4 days', trend: null, action: 'A' }, comingUp: { daysToPeriod: -1, phases: [] } },
    { focus: { goal: 'Understand my cycle', headline: 'H', metric: 'Period expected in 4 days', trend: null, action: 'A' }, comingUp: { daysToPeriod: NaN, phases: [] } },
  ];
  for (const tc of cases) {
    const out = base(tc.focus, tc.comingUp, pred, current);
    assert.match(out, /Next period/, 'Cycle remains eligible to display valid period estimate: ' + JSON.stringify(tc.comingUp));
  }
  for (const tc of cases) {
    const out = base(tc.focus, tc.comingUp, predNo, curNo);
    if (tc.comingUp && Number.isFinite(tc.comingUp.daysToPeriod) && tc.comingUp.daysToPeriod > 0) {
      assert.match(out, /Period expected in 4 days\./, 'Coming up remains eligible when Cycle has no valid estimate');
    } else {
      assert.ok(!/Period expected in 4 days\./.test(out), 'invalid/missing coming period not fabricated');
    }
  }
});

test('Period ownership: read-only mode does not claim hidden Focus period evidence', () => {
  const { smartInsightsHTML } = renderContext();
  const pred = predictedState(false);
  const current = { state: 'estimated', phase: 'Luteal', phaseLabel: 'Luteal phase', cycleDay: 18, cycleLength: 28, confidence: 'Limited history', predictedDate: '2026-04-23' };
  const predNo = { state: 'limited-history', expected: null };
  const curNo = { state: 'single-start', phase: null, phaseLabel: null, cycleDay: null, cycleLength: null, confidence: 'Limited history', predictedDate: null };
  const out = smartInsightsHTML(pred, current, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: null, action: 'Keep logging.' },
    week: [], ro: true, weekCard: null, weekFacts: null,
    comingUp: { daysToPeriod: 4, phases: [] }
  });
  assert.ok(!/Your focus/.test(out));
  assert.ok(!/Period expected in 4 days/.test(out.replace(/[\s\S]*<section class="smart-section smart-cycle"[\s\S]*?<\/section>/,'')), 'hidden focus metric not rendered elsewhere as focus claim');
  assert.match(out, /Next period/, 'Cycle remains eligible when focus hidden');
  const out2 = smartInsightsHTML(predNo, curNo, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: null, action: 'Keep logging.' },
    week: [], ro: true, weekCard: null, weekFacts: null,
    comingUp: { daysToPeriod: 4, phases: [] }
  });
  assert.ok(!/Your focus/.test(out2));
  assert.ok(!/Next period/.test(out2));
  assert.match(out2, /Period expected in 4 days\./, 'Coming up remains eligible if Cycle has no valid estimate');
});

test('Period ownership: registry is render-scoped and does not leak between renders', () => {
  const { smartInsightsHTML } = renderContext();
  const pred = predictedState(false);
  const current = { state: 'estimated', phase: 'Luteal', phaseLabel: 'Luteal phase', cycleDay: 18, cycleLength: 28, confidence: 'Limited history', predictedDate: '2026-04-23' };
  const predNo = { state: 'limited-history', expected: null };
  const curNo = { state: 'single-start', phase: null, phaseLabel: null, cycleDay: null, cycleLength: null, confidence: 'Limited history', predictedDate: null };
  const extrasOwned = {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: null, action: 'Keep logging.' },
    week: [], ro: false, weekCard: null, weekFacts: null,
    comingUp: { daysToPeriod: 4, phases: [] }
  };
  const extrasComing = {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Log period start dates to see this', metric: null, trend: null, action: null },
    week: [], ro: false, weekCard: null, weekFacts: null,
    comingUp: { daysToPeriod: 4, phases: [] }
  };
  const out1 = smartInsightsHTML(pred, current, [], 'Alex', null, extrasOwned);
  assert.match(out1, /your period is close enough/);
  assert.ok(!/Next period/.test(out1));
  const out2 = smartInsightsHTML(predNo, curNo, [], 'Alex', null, extrasComing);
  assert.ok(!/Next period/.test(out2));
  assert.match(out2, /Period expected in 4 days\./, 'later render can show Coming up period when no higher-priority owner');
  const out3 = smartInsightsHTML(pred, current, [], 'Alex', null, extrasOwned);
  assert.ok(!/Next period/.test(out3));
});




test('Focus period metric sanitation: invalid structured period evidence clears only Focus metric', () => {
  const { smartInsightsHTML } = renderContext();
  const pred = predictedState(false);
  const current = { state: 'estimated', phase: 'Luteal', phaseLabel: 'Luteal phase', cycleDay: 18, cycleLength: 28, confidence: 'Limited history', predictedDate: '2026-04-23' };
  const base = (comingUp) => smartInsightsHTML(pred, current, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: 'Last cycle 28 days vs 28 days before', action: 'Keep logging.' },
    week: [], ro: false, weekCard: null, weekFacts: null, comingUp
  });
  const cases = [
    ['missing comingUp', undefined],
    ['missing daysToPeriod', { phases: [] }],
    ['daysToPeriod 0', { daysToPeriod: 0, phases: [] }],
    ['negative daysToPeriod', { daysToPeriod: -1, phases: [] }],
    ['NaN daysToPeriod', { daysToPeriod: NaN, phases: [] }],
    ['Infinity daysToPeriod', { daysToPeriod: Infinity, phases: [] }],
  ];
  for (const [name, cu] of cases) {
    const out = base(cu);
    const focusSection = (out.match(/<section class="smart-section smart-focus"[\s\S]*?<\/section>/) || [''])[0];
    assert.ok(focusSection, name + ': focus rendered');
    assert.ok(!/your period is close/.test(focusSection), name + ': stale focus period wording must be absent');
    assert.match(focusSection, /Understanding your cycle is the goal/, name + ': plain-language frame preserved');
    assert.match(focusSection, /Keep noting how you feel each day/, name + ': advice preserved');
  }
});

test('Focus period metric sanitation: valid ownership and non-cycle goals preserved', () => {
  const { smartInsightsHTML } = renderContext();
  const pred = predictedState(false);
  const current = { state: 'estimated', phase: 'Luteal', phaseLabel: 'Luteal phase', cycleDay: 18, cycleLength: 28, confidence: 'Limited history', predictedDate: '2026-04-23' };
  const comingUp = { daysToPeriod: 4, phases: [{ phase: 'Follicular', phaseLabel: 'Follicular phase', startsIn: 2, mood: 3, energy: 3, stress: 2, symptoms: [] }] };

  // valid + Your week owns period: suppress only Focus metric, period appears once (Your week)
  const outOwned = smartInsightsHTML(pred, current, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: null, action: 'Keep logging.' },
    week: [], ro: false,
    weekCard: { headline: 'Your week', summary: 'Period in 4 days.', actions: ['Note symptoms as they show up', 'Plan a short walk'] },
    weekFacts: { goals: ['Understand my cycle'], week: [], comingUp: [], focus: { headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: '' }, daysToPeriod: 4 },
    comingUp
  });
  const focusOwned = (outOwned.match(/<section class="smart-section smart-focus"[\s\S]*?<\/section>/) || [''])[0];
  assert.ok(!/your period is close/.test(focusOwned), 'Focus period wording suppressed when Your week owns period');
  assert.match(focusOwned, /Understanding your cycle is the goal/);
  assert.match(focusOwned, /Keep noting how you feel each day/);
  assert.equal((outOwned.match(/before your period/g) || []).length, 1, 'period mentioned in no more than one section');

  // valid + Your week does not own period: Focus claims and may display metric, no duplicate
  const outFocus = smartInsightsHTML(pred, current, [], 'Alex', null, {
    selectedGoal: 'Understand my cycle', focusGoals: ['Understand my cycle'], noGoals: false,
    focus: { goal: 'Understand my cycle', headline: 'Day 18 of ~28 · Luteal phase', metric: 'Period expected in 4 days', trend: null, action: 'Keep logging.' },
    week: [], ro: false, weekCard: null, weekFacts: null, comingUp
  });
  const focusClaim = (outFocus.match(/<section class="smart-section smart-focus"[\s\S]*?<\/section>/) || [''])[0];
  assert.match(focusClaim, /your period is close enough/);
  assert.ok(!/Next period/.test(outFocus));
  assert.equal((outFocus.match(/your period is close enough/g) || []).length, 1, 'period mentioned in no more than one section');

  // non-cycle goal unchanged
  const outSleep = smartInsightsHTML(pred, current, [], 'Alex', null, extras({}));
  const focusSleep = (outSleep.match(/<section class="smart-section smart-focus"[\s\S]*?<\/section>/) || [''])[0];
  assert.match(focusSleep, /Better sleep is the goal you chose/);
  assert.ok(!/\d\.\d/.test(focusSleep), 'focus prose carries no measurements');
});


test('prose copy reads as calm sentences with no numbers or stiff words', () => {
  const mod = renderContext();
  const goals = ['Understand my cycle','Steadier energy','Better sleep','Move more','Eat regularly','Manage stress','Prepare for doctor visits'];
  const banned = /\b(undefined|NaN|AI|insight|pattern|wellness|journey|self-care|balance|track|data|logs)\b/i;
  const extrasBase = {
    focusGoals: ['Better sleep'],
    noGoals: false,
    week: [{ key:'sleep', label:'Sleep', now:6.4, prev:7.6, arrow:'↓' },{ key:'energy', label:'Energy', now:3.2, prev:2.8, arrow:'↑' },{ key:'stress', label:'Stress', now:3.8, prev:2.4, arrow:'↑' }],
    comingUp: { daysToPeriod: 4, phases: [{ phase:'Luteal', phaseLabel:'Luteal phase', startsIn: 2, mood: 3, energy: 3, stress: 3, symptoms: ['Cramps'] }] },
    weekCard: { headline:'x', summary:'x', actions:['x','x'] },
    weekFacts: { goals:['Better sleep'], week:[{ label:'Sleep', now:6.4, prev:7.6 }], comingUp:[], focus:{ headline:'x', metric:'', trend:'' }, daysToPeriod:4, cycleDay:18, phaseLabel:'Luteal phase' },
    ro: false,
    ctx: {
      logs: { '2026-01-14': { sleep:6, energy:3 }, '2026-01-15': { sleep:6, energy:3 }, '2026-01-16': { sleep:7, energy:4 } },
      current: { state:'estimated', phase:'Luteal', phaseLabel:'Luteal phase', cycleDay:18, cycleLength:28 },
      pred: { state:'predicted', avg:28, last:'2026-01-01', expected:'2026-01-24', validCount:5 },
      todayStr: '2026-01-20',
      meals: {}
    }
  };
  for (const goal of goals) {
    const extras = Object.assign({}, extrasBase, { selectedGoal: goal, focusGoals: [goal],
      focus: { goal, headline:'Headline', metric:'Metric', trend:'2 vs 4 the week before', action:'Action' } });
    const week = mod.smartWeekProse(extras);
    const focus = mod.smartFocusProse(goal, extras, { metric: 'Metric' });
    const know = mod.smartKnowledgeProse(goal, extras);
    const next = mod.smartNextProse(goal);
    const parts = [week.lead, week.body, week.closer, focus, know, next].filter(Boolean);
    const all = parts.join(' ');
    assert.ok(all.length > 40, goal + ': prose present');
    assert.ok(!/\d/.test(all), goal + ': no digits');
    assert.ok(!banned.test(all), goal + ': no stiff words');
    assert.ok(!/[!?]|—/.test(all), goal + ': no exclamation, question or em dash');
    for (const part of parts) {
      assert.ok(/\.$/.test(part), goal + ': ends with a period');
      const sentences = part.split(/(?<=[.!])\s+/).filter(Boolean);
      assert.ok(sentences.length <= 3, goal + ': at most three sentences');
    }
  }
});
