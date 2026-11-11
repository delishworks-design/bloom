const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./load');

function renderContext() {
  const ctx = load();
  ctx.fmt = (date, opts) => new Date(`${date}T12:00`).toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric' });
  ctx.phaseRanges = (len) => {
    const fol = Math.round(len * .45), ovu = Math.round(len * .58);
    return [
      ['Menstrual', 1, 5],
      ['Follicular', 6, fol],
      ['Ovulation', fol + 1, ovu],
      ['Luteal', ovu + 1, len]
    ];
  };
  ctx.polarPt = (cx, cy, r, deg) => {
    const a = deg * Math.PI / 180;
    return { x: (cx + r * Math.cos(a)).toFixed(2), y: (cy + r * Math.sin(a)).toFixed(2) };
  };
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
    confidence: 'Limited history',
    reason: 'Estimated from your recorded history.'
  };
}

test('single header and one shared disclaimer', () => {
  const { smartInsightsHTML } = renderContext();
  const current = { state: 'due-today', phase: null, phaseLabel: null, cycleDay: null, cycleLength: null, confidence: 'Limited history', predictedDate: '2026-04-23' };
  const html = smartInsightsHTML(predictedState(), current, [], 'Alex');

  assert.equal((html.match(/Smart Insights/g) || []).length, 1);
  assert.ok(!/smart-eyebrow/.test(html));
  assert.match(html, /Personal patterns/);
  assert.equal((html.match(/Not medical advice or a diagnosis\./g) || []).length, 1);
  assert.ok(!/How to read these insights/.test(html));
  assert.ok(!/not proof|does not prove/.test(html));
  assert.match(html, /Your period is expected around now\./);
});

test('empty Smart Insights states never invent facts', () => {
  const { smartInsightsHTML, smartProgress } = renderContext();
  const pred = {
    state: 'single-start',
    startCount: 1,
    validCount: 0,
    last: '2026-01-01',
    expected: null,
    rangeStart: null,
    rangeEnd: null,
    overdue: false,
    confidence: 'Insufficient data',
    reason: 'One period start recorded.'
  };
  const current = { state: 'single-start', phase: null, phaseLabel: null, cycleDay: null, cycleLength: null, confidence: 'Insufficient data' };
  const html = smartInsightsHTML(pred, current, [], undefined, null, { progress: smartProgress({}) });

  assert.ok(!/No patterns yet/.test(html));
  assert.match(html, /A little more logging/);
  assert.match(html, /Log sleep and energy on 5 more days to see this pattern\./);
  assert.match(html, /Log at least 3 period start dates to see cycle estimates\./);
  assert.ok(!/\bundefined\b|\bNaN\b|<img|<script|http:\/\/|https:\/\//i.test(html));
});

test('pattern items render with their observation count', () => {
  const { smartInsightsHTML } = renderContext();
  const current = {
    state: 'estimated',
    phase: 'Follicular',
    phaseLabel: 'Follicular phase',
    cycleDay: 12,
    cycleLength: 28,
    confidence: 'Limited history',
    predictedDate: '2026-04-23'
  };
  const patterns = [{
    type: 'sleep-energy',
    count: 3,
    text: 'Recorded sleep and energy were compared from your records.'
  }];
  const html = smartInsightsHTML(predictedState(), current, patterns, 'Alex');

  assert.match(html, /Sleep and energy/);
  assert.match(html, /Based on 3 observations/);
});

test('pattern text is HTML escaped', () => {
  const { smartInsightsHTML } = renderContext();
  const pred = predictedState();
  const current = { state: 'due-today', phase: null, phaseLabel: null, cycleDay: null, cycleLength: null, confidence: 'Limited history', predictedDate: pred.expected };
  const html = smartInsightsHTML(pred, current, [{
    type: 'symptom-phase',
    count: 4,
    text: '<img src=x onerror=alert(1)>'
  }], 'Alex');

  assert.ok(!html.includes('<img src=x'));
  assert.match(html, /&lt;img src=x/);
});

test('Smart Insights markup is mobile-oriented and uses no external assets', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  assert.ok(html.includes('.smart-card{padding:0;gap:0;overflow:hidden}'));
  assert.ok(html.includes('@media (max-width:430px)'));
  assert.ok(html.includes('svg{width:100%;height:auto;display:block;max-width:100%}'));
  const smartBlock = html.slice(html.indexOf('function smartInsightsHTML('), html.indexOf('function insights('));
  assert.ok(!/<script|\bhttp:\/\//i.test(smartBlock));
});

test('cycle section shows day, phase, next period and confidence', () => {
  const { smartInsightsHTML } = renderContext();
  const current = { state: 'estimated', phase: 'Follicular', phaseLabel: 'Follicular phase', cycleDay: 12, cycleLength: 28, confidence: 'Limited history' };
  const html = smartInsightsHTML(predictedState(), current, [], 'Alex');

  assert.match(html, /Day 12 of ~28 · Follicular phase/);
  assert.match(html, /Next period ~Apr 23 \(range Apr 20–Apr 30\)/);
  assert.match(html, /Limited history/);
});

test('overdue and due-today use short plain messages', () => {
  const { smartInsightsHTML } = renderContext();
  const overdue = { state: 'overdue', phase: null, phaseLabel: null, cycleDay: null, cycleLength: 28, confidence: 'Limited history' };
  const due = { state: 'due-today', phase: null, phaseLabel: null, cycleDay: null, cycleLength: 28, confidence: 'Limited history' };

  assert.match(smartInsightsHTML(predictedState(true), overdue, []), /later than expected/);
  assert.match(smartInsightsHTML(predictedState(), due, []), /expected around now/);
});

test('phase insight renders when supplied and early patterns get a badge', () => {
  const { smartInsightsHTML } = renderContext();
  const current = { state: 'estimated', phase: 'Luteal', phaseLabel: 'Luteal phase', cycleDay: 20, cycleLength: 28, confidence: 'Limited history' };
  const patterns = [{
    type: 'sleep-energy',
    id: 'sleep-energy',
    headline: 'Short sleep days = lower energy',
    detail: 'Under 7h: energy 2.3/5 (4 days) vs 7h+: 3.8/5 (6 days)',
    tip: 'Try an earlier bedtime on busy days.',
    count: 4,
    confidenceLevel: 'Early'
  }];
  const extras = {
    phaseInsight: { headline: 'Energy tends to dip in your luteal phase', detail: 'Energy 1/5 on 3 luteal phase days vs 3/5 overall', tip: 'Plan lighter days.' }
  };
  const html = smartInsightsHTML(predictedState(), current, patterns, 'Alex', null, extras);

  assert.match(html, /Cycle connection/);
  assert.match(html, /Energy tends to dip in your luteal phase/);
  assert.match(html, /Short sleep days = lower energy/);
  assert.match(html, /Energy 2.3\/5|Under 7h/);
  assert.match(html, /Early pattern/);
  assert.match(html, /Based on 4 observations/);
});

test('AI overrides headline and summary while keeping the Cloud AI label', () => {
  const { smartInsightsHTML } = renderContext();
  const patterns = [{ type: 'sleep-energy', id: 'p1', headline: 'Local headline', detail: 'Local detail', tip: 'Local tip', count: 3 }];
  const aiMap = { p1: { title: 'AI title', summary: 'AI summary', takeaway: 'AI takeaway' } };
  const html = smartInsightsHTML(predictedState(), { state: 'due-today' }, patterns, 'Alex', aiMap);

  assert.match(html, /AI title/);
  assert.match(html, /AI summary/);
  assert.match(html, /AI takeaway/);
  assert.match(html, /Cloud AI explanation/);
  assert.ok(!html.includes('Local headline'));
});

test('headline, detail and tip are HTML escaped', () => {
  const { smartInsightsHTML } = renderContext();
  const patterns = [{
    type: 'symptom-phase',
    id: 's',
    headline: '<img src=x onerror=alert(1)>',
    detail: '<b>detail</b>',
    tip: '<i>tip</i>',
    count: 3
  }];
  const html = smartInsightsHTML(predictedState(), { state: 'due-today' }, patterns);

  assert.ok(!/<img src=x|<b>detail|<i>tip/.test(html));
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /&lt;b&gt;detail/);
  assert.match(html, /&lt;i&gt;tip/);
});
