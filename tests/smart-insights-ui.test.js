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

test('predicted Smart Insights renders a prominent range and timeline', () => {
  const { smartInsightsHTML } = renderContext();
  const current = { state: 'due-today', phase: null, phaseLabel: null, cycleDay: null, cycleLength: null, confidence: 'Limited history', predictedDate: '2026-04-23' };
  const html = smartInsightsHTML(predictedState(), current, [], 'Alex');

  assert.match(html, /Smart Insights/);
  assert.match(html, /Next period/);
  assert.match(html, /Apr 20, 2026 – Apr 30, 2026/);
  assert.match(html, /smart-timeline/);
  assert.match(html, /Estimated cycle/);
  assert.match(html, /Limited history/);
  assert.match(html, /How to read these insights/);
  assert.match(html, /Bloom does not diagnose medical conditions\./);
});

test('empty Smart Insights states never invent facts', () => {
  const { smartInsightsHTML } = renderContext();
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
  const html = smartInsightsHTML(pred, current, []);

  assert.match(html, /One recorded start/);
  assert.match(html, /Not available yet/);
  assert.match(html, /No patterns yet/);
  assert.ok(!/\bundefined\b|\bNaN\b|<img|<script|http:\/\/|https:\/\//i.test(html));
});

test('overdue Smart Insights shows the passed date without a new cycle', () => {
  const { smartInsightsHTML } = renderContext();
  const pred = predictedState(true);
  const current = { state: 'overdue', phase: null, phaseLabel: null, cycleDay: null, cycleLength: 28, confidence: 'Limited history', predictedDate: pred.expected };
  const html = smartInsightsHTML(pred, current, []);

  assert.match(html, /Expected date passed/);
  assert.match(html, /Apr 23, 2026/);
  assert.match(html, /Expected date passed/);
  assert.ok(!/Day 1/.test(html));
});

test('current estimated phase renders a circular visualization and pattern items', () => {
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

  assert.match(html, /Day 12 of 28/);
  assert.match(html, /Follicular phase/);
  assert.match(html, /role="img" aria-label="Current cycle phase/);
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
