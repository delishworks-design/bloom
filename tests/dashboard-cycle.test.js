const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const { dashboardCycle, smartHistoricalPhaseFor } = load();

const regularStarts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'];

test('insufficient history does not display a confirmed phase', () => {
  const none = dashboardCycle([], '2026-01-10');
  assert.equal(none.state, 'no-history');
  assert.equal(none.cycleDay, null);
  assert.equal(none.phase, null);

  const oneStart = dashboardCycle(['2026-01-01'], '2026-01-10');
  assert.equal(oneStart.state, 'single-start');
  assert.equal(oneStart.cycleDay, null);
  assert.equal(oneStart.phase, null);

  const limited = dashboardCycle(['2026-01-01', '2026-01-29'], '2026-02-02');
  assert.equal(limited.state, 'limited-history');
  assert.equal(limited.cycleDay, null);
  assert.equal(limited.phase, null);
});

test('a normal cycle displays the correct cycle day and estimated phase', () => {
  const current = dashboardCycle(regularStarts, '2026-04-01');

  assert.equal(current.state, 'estimated');
  assert.equal(current.cycleDay, 7);
  assert.equal(current.phase, 'Follicular');
  assert.equal(current.cycleLength, 28);
});

test('the expected period date does not wrap into day one', () => {
  const due = dashboardCycle(regularStarts, '2026-04-23');

  assert.equal(due.state, 'due-today');
  assert.equal(due.cycleDay, null);
  assert.equal(due.phase, null);
  assert.equal(due.predictedDate, '2026-04-23');
});

test('an overdue cycle does not return to day one or receive a false phase', () => {
  const overdue = dashboardCycle(regularStarts, '2026-04-24');

  assert.equal(overdue.state, 'overdue');
  assert.equal(overdue.cycleDay, null);
  assert.equal(overdue.phase, null);
  assert.equal(overdue.predictedDate, '2026-04-23');
});

test('recording a new actual period start begins that cycle at day one', () => {
  const restarted = dashboardCycle(
    [...regularStarts, '2026-04-24'],
    '2026-04-24'
  );

  assert.equal(restarted.state, 'estimated');
  assert.equal(restarted.cycleDay, 1);
  assert.equal(restarted.phase, 'Menstrual');
  assert.equal(restarted.cycleLength, 28);
});

test('existing historical phase calculations remain unchanged', () => {
  assert.equal(smartHistoricalPhaseFor('2026-01-10', regularStarts).phase, 'Follicular');
  assert.equal(smartHistoricalPhaseFor('2026-01-21', regularStarts).phase, 'Luteal');
  assert.equal(smartHistoricalPhaseFor('2026-01-21', regularStarts).day, 21);
  assert.equal(smartHistoricalPhaseFor('2026-01-21', regularStarts).length, 28);
});
