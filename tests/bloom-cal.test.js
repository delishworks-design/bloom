const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

test('calMonthsHTML cycle mode renders all 12 months with data-cal-ym anchors and correct January cell count', () => {
  const { calMonthsHTML } = load();
  const html = calMonthsHTML(2026, null, 'cycle');
  const months = html.match(/data-cal-ym="2026-\d\d"/g) || [];
  assert.equal(months.length, 12);
  assert.ok(html.includes('January 2026'));
  assert.ok(html.includes('December 2026'));
  const jan = html.match(/data-cal-ym="2026-01"[\s\S]*?<\/section>/)[0];
  assert.equal((jan.match(/data-cal-d="2026-01-/g) || []).length, 31);
});

test('calMonthsHTML cycle mode renders February 2026 with 28 days', () => {
  const { calMonthsHTML } = load();
  const html = calMonthsHTML(2026, null, 'cycle');
  const feb = html.match(/data-cal-ym="2026-02"[\s\S]*?<\/section>/)[0];
  assert.equal((feb.match(/data-cal-d="2026-02-/g) || []).length, 28);
});

test('calMonthsHTML planner mode renders all 12 months with data-cal-ym anchors', () => {
  const { calMonthsHTML } = load();
  const doc = { tasks: [] };
  const html = calMonthsHTML(2026, doc, 'planner');
  const months = html.match(/data-cal-ym="2026-\d{2}"/g) || [];
  assert.equal(months.length, 12);
  assert.ok(html.includes('January 2026'));
  assert.ok(html.includes('December 2026'));
});

test('calContinueBtn points to the following year', () => {
  const { calContinueBtn } = load();
  assert.ok(calContinueBtn(2026).includes('data-cal-next="2027"'));
  assert.ok(calContinueBtn(2026).includes('Continue to 2027'));
});

test('predictedBleedWindows extrapolates average cycle into future bleed windows', () => {
  const { predictedBleedWindows } = load();
  const out = predictedBleedWindows(['2026-09-01', '2026-10-01', '2026-11-01'], { avg: 31, plen: 5, until: '2026-12-31' });
  assert.ok(out.length >= 1);
  assert.equal(out[0].from, '2026-12-02');
  assert.equal(out[0].to, '2026-12-06');
  assert.ok(!out.some(w => w.from.startsWith('2026-11')));
});

test('predictedBleedWindows returns nothing with insufficient history', () => {
  const { predictedBleedWindows } = load();
  assert.equal(predictedBleedWindows([], { avg: 28 }).length, 0);
  assert.equal(predictedBleedWindows(['2026-09-01'], { avg: 28 }).length, 0);
  assert.equal(predictedBleedWindows(['2026-09-01', '2026-10-01'], { avg: 0 }).length, 0);
  assert.equal(predictedBleedWindows(['2026-09-01', '2026-10-01'], { avg: 400 }).length, 0);
});

test('calMonthsHTML cycle mode marks predicted days with class pr and never bleeding .p on those dates', () => {
  const { calMonthsHTML } = load();
  const windows = [{ from: '2026-12-02', to: '2026-12-06' }];
  const html = calMonthsHTML(2026, null, 'cycle', windows);
  const dec = html.match(/data-cal-ym="2026-12"[\s\S]*?<\/section>/)[0];
  for (const d of ['02', '03', '04', '05', '06']) {
    const m = dec.match(new RegExp('<button[^>]*data-cal-d="2026-12-' + d + '"[^>]*>'));
    assert.ok(m, 'cell 2026-12-' + d);
    assert.ok(m[0].includes('pr'), 'cell 2026-12-' + d + ' should carry pr');
  }
  const jan = html.match(/data-cal-ym="2026-01"[\s\S]*?<\/section>/)[0];
  assert.equal((jan.match(/class="cal-cell pr"/g) || []).length, 0);
});

test('calMonthsHTML cycle mode without a pred argument emits zero pr cells (date picker stays clean)', () => {
  const { calMonthsHTML } = load();
  const html = calMonthsHTML(2026, null, 'cycle');
  assert.equal((html.match(/class="cal-cell pr"/g) || []).length, 0);
});
