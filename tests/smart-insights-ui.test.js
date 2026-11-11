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
  assert.ok(!/Log sleep and energy on/.test(out));
  assert.ok(!/not proof|does not prove/.test(out));
});

test('empty patterns render one short line', () => {
  const { smartInsightsHTML } = renderContext();
  const out = smartInsightsHTML(predictedState(), currentState(), [], undefined, null, extras());

  assert.equal((out.match(/Log a few more days to see insights\./g) || []).length, 1);
  assert.ok(!/\bundefined\b|\bNaN\b|<img|<script/i.test(out));
});

test('focus card shows the selected goal and switching chips when several goals exist', () => {
  const { smartInsightsHTML } = renderContext();
  const out = smartInsightsHTML(predictedState(), currentState(), [], 'Alex', null, extras());

  assert.match(out, /Your focus/);
  assert.match(out, /Sleep 6\.8 h last week/);
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
  const patterns = ['a', 'b', 'c', 'd'].map((k, i) => ({
    type: 'sleep-energy',
    id: k,
    headline: 'Headline ' + i,
    detail: 'Detail ' + i,
    tip: 'Tip ' + i
  }));
  const out = smartInsightsHTML(predictedState(), currentState(), patterns);

  assert.match(out, /Headline 0/);
  assert.match(out, /Headline 2/);
  assert.ok(!/Headline 3/.test(out));
});

test('AI overrides still replace headline and summary', () => {
  const { smartInsightsHTML } = renderContext();
  const patterns = [{ type: 'sleep-energy', id: 'p1', headline: 'Local headline', detail: 'Local detail', tip: 'Local tip' }];
  const aiMap = { p1: { title: 'AI title', summary: 'AI summary', takeaway: 'AI takeaway' } };
  const out = smartInsightsHTML(predictedState(), currentState(), patterns, 'Alex', aiMap);

  assert.match(out, /AI title/);
  assert.match(out, /AI summary/);
  assert.match(out, /AI takeaway/);
  assert.ok(!out.includes('Local headline'));
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

test('Cloud AI row keeps the consent id and has no explanatory paragraph', () => {
  const start = html.indexOf('function smartAIConsentHTML(){');
  const end = html.indexOf('function wireSmartAI(', start);
  const source = html.slice(start, end);

  assert.ok(source.includes('id="ai-consent"'));
  assert.ok(source.includes('smart-ai-row'));
  assert.ok(!/Let Cloud AI explain/.test(source));
  assert.ok(!/external AI service/.test(source));
  assert.ok(!/Journal entries/.test(source));
});

test('the only app disclaimer lives in Settings', () => {
  assert.equal((html.match(/Bloom shows patterns from your logs\. It is not medical advice\./g) || []).length, 1);
  assert.ok(html.includes('<h3>App</h3>'));
});
