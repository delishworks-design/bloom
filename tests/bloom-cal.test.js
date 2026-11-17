const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

test('calMonthBlock renders the right number of data-d cells for a 31-day month', () => {
  const { calMonthBlock } = load();
  const html = calMonthBlock(2026, 0); // Jan 2026
  const cells = html.match(/data-cal-d="2026-01-/g) || [];
  assert.equal(cells.length, 31);
  assert.ok(html.includes('January 2026'));
});

test('calMonthBlock renders February 2026 with 28 days', () => {
  const { calMonthBlock } = load();
  const html = calMonthBlock(2026, 1); // Feb 2026
  const cells = html.match(/data-cal-d="2026-02-/g) || [];
  assert.equal(cells.length, 28);
});

test('calMonthBlock zero-index months mark data-cal-ym correctly', () => {
  const { calMonthBlock } = load();
  const html = calMonthBlock(2027, 11); // Dec 2027
  assert.ok(html.includes('December 2027'));
  assert.ok(html.includes('data-cal-ym="2027-12"'));
});

test('calContinueBtn points to the following year', () => {
  const { calContinueBtn } = load();
  assert.ok(calContinueBtn(2026).includes('data-cal-next="2027"'));
  assert.ok(calContinueBtn(2026).includes('Continue to 2027'));
});


test('calMonthsHTML renders all 12 months of the year with data-cal-ym anchors', () => {
  const { calMonthsHTML } = load();
  const doc = { tasks: [] };
  const html = calMonthsHTML(2026, doc, 'planner');
  const months = html.match(/data-cal-ym="2026-\d{2}"/g) || [];
  assert.equal(months.length, 12);
  assert.ok(html.includes('January 2026'));
  assert.ok(html.includes('December 2026'));
});
