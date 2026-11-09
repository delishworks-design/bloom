const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./load');

const {
  smartPredictionHistory,
  smartCurrentCycle,
  smartCurrentCycleFromHistory,
  smartHistoricalPhaseFor,
  smartPatternsFromLogs
} = load();

const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'];

test('no period history produces no prediction, cycle day or phase', () => {
  const prediction = smartPredictionHistory([], '2026-01-15');
  const current = smartCurrentCycle(prediction, '2026-01-15');

  assert.equal(prediction.state, 'no-history');
  assert.equal(prediction.validCount, 0);
  assert.equal(prediction.expected, null);
  assert.equal(current.phase, null);
  assert.equal(current.cycleDay, null);
  assert.equal(smartPatternsFromLogs({}, []).length, 0);
});

test('one period start is insufficient cycle history', () => {
  const prediction = smartPredictionHistory(['2026-01-01'], '2026-01-15');
  const current = smartCurrentCycle(prediction, '2026-01-15');

  assert.equal(prediction.state, 'single-start');
  assert.equal(prediction.validCount, 0);
  assert.equal(prediction.expected, null);
  assert.equal(current.phase, null);
});

test('two period starts create only one valid interval and stay limited', () => {
  const prediction = smartPredictionHistory(['2026-01-01', '2026-01-29'], '2026-02-02');

  assert.equal(prediction.state, 'limited-history');
  assert.equal(prediction.validCount, 1);
  assert.equal(prediction.confidence, 'Limited history');
  assert.equal(prediction.expected, null);
});

test('three or more period starts use the recorded valid intervals', () => {
  const prediction = smartPredictionHistory(starts, '2026-04-01');

  assert.equal(prediction.state, 'predicted');
  assert.equal(prediction.validCount, 3);
  assert.equal(prediction.avg, 28);
  assert.equal(prediction.min, 28);
  assert.equal(prediction.max, 28);
  assert.equal(prediction.expected, '2026-04-23');
});

test('intervals outside 15 to 120 days are excluded from prediction', () => {
  const prediction = smartPredictionHistory(
    ['2026-01-01', '2026-01-11', '2026-02-08', '2026-03-08'],
    '2026-03-20'
  );

  assert.equal(prediction.validCount, 2);
  assert.equal(prediction.avg, 28);
  assert.equal(prediction.min, 28);
  assert.equal(prediction.max, 28);
  assert.equal(prediction.expected, '2026-04-05');
});

test('irregular cycle history shows a range and limited confidence', () => {
  const prediction = smartPredictionHistory(
    ['2026-01-01', '2026-01-29', '2026-03-25', '2026-04-22'],
    '2026-04-26'
  );

  assert.equal(prediction.state, 'predicted');
  assert.equal(prediction.min, 28);
  assert.equal(prediction.max, 55);
  assert.equal(prediction.rangeStart, '2026-05-20');
  assert.equal(prediction.rangeEnd, '2026-06-16');
  assert.equal(prediction.confidence, 'Limited history');
});

test('an overdue prediction does not wrap the cycle day', () => {
  const prediction = smartPredictionHistory(starts, '2026-05-01');
  const current = smartCurrentCycle(prediction, '2026-05-01');

  assert.equal(prediction.expected, '2026-04-23');
  assert.equal(prediction.overdue, true);
  assert.equal(current.state, 'overdue');
  assert.equal(current.phase, null);
  assert.equal(current.cycleDay, null);
});

test('sparse observations do not create a pattern', () => {
  const logs = {
    '2026-01-01': { sleep: 5, energy: 2 },
    '2026-01-02': { sleep: 5, energy: 2 },
    '2026-01-03': { sleep: 8, energy: 5 },
    '2026-01-04': { sleep: 8, energy: 5 },
    '2026-01-05': { sleep: 8, energy: 5 }
  };

  assert.equal(smartPatternsFromLogs(logs, starts).length, 0);
});

test('supported patterns expose their actual observation counts', () => {
  const logs = {
    '2026-01-01': { sleep: 5, energy: 2 },
    '2026-01-02': { sleep: 5, energy: 2 },
    '2026-01-03': { sleep: 5, energy: 3 },
    '2026-01-04': { sleep: 8, energy: 5 },
    '2026-01-05': { sleep: 8, energy: 4 },
    '2026-01-06': { sleep: 8, energy: 5 }
  };

  const patterns = smartPatternsFromLogs(logs, starts);
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].type, 'sleep-energy');
  assert.match(patterns[0].text, /less than 6 hours/);
  assert.match(patterns[0].text, /does not prove causation/);
});

test('activity and mood patterns need sufficient observations', () => {
  const activeLogs = {
    '2026-01-01': { exercise: 'Walk', exMin: 30, energy: 5 },
    '2026-01-02': { exercise: 'Yoga', exMin: 30, energy: 4 },
    '2026-01-03': { exercise: 'Run', exMin: 30, energy: 5 },
    '2026-01-04': { exercise: 'Walk', exMin: 5, energy: 2 },
    '2026-01-05': { exercise: 'Walk', exMin: 5, energy: 3 },
    '2026-01-06': { exercise: 'Walk', exMin: 5, energy: 2 }
  };
  const moodLogs = {
    '2026-01-01': { mood: 2, sleep: 5 },
    '2026-01-02': { mood: 2, sleep: 5 },
    '2026-01-03': { mood: 2, sleep: 5 },
    '2026-01-04': { mood: 5, sleep: 8 },
    '2026-01-05': { mood: 5, sleep: 8 },
    '2026-01-06': { mood: 5, sleep: 8 }
  };

  const activity = smartPatternsFromLogs(activeLogs, starts);
  const mood = smartPatternsFromLogs(moodLogs, starts);
  assert.equal(activity.length, 1);
  assert.equal(activity[0].type, 'activity-energy');
  assert.equal(activity[0].count, 3);
  assert.equal(mood.length, 1);
  assert.equal(mood[0].type, 'mood-sleep');
  assert.equal(mood[0].count, 3);
});

test('symptom patterns use completed historical cycle phases', () => {
  const logs = {
    '2026-01-01': { tags: ['Bloating'] },
    '2026-01-02': { tags: [] },
    '2026-01-03': { tags: [] },
    '2026-01-04': { tags: [] },
    '2026-01-05': { tags: [] },
    '2026-01-17': { tags: ['Bloating'] },
    '2026-01-18': { tags: ['Bloating'] },
    '2026-01-19': { tags: ['Bloating'] },
    '2026-01-20': { tags: ['Bloating'] },
    '2026-01-21': { tags: ['Bloating'] }
  };
  const patterns = smartPatternsFromLogs(logs, ['2026-01-01', '2026-01-29']);

  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].type, 'symptom-phase');
  assert.equal(patterns[0].count, 6);
  assert.match(patterns[0].text, /luteal-phase days with symptom fields recorded, compared with 1 of 5/);
});

test('missing and malformed symptom fields do not increase denominators', () => {
  const logs = {
    '2026-01-01': { tags: ['Bloating'] },
    '2026-01-02': { tags: [] },
    '2026-01-03': { tags: [] },
    '2026-01-04': { tags: [] },
    '2026-01-05': { tags: [] },
    '2026-01-06': { tags: [] },
    '2026-01-07': { water: 4 },
    '2026-01-08': { tags: null, customSx: 'Bloating' },
    '2026-01-17': { tags: ['Bloating'] },
    '2026-01-18': { tags: ['Bloating'] },
    '2026-01-19': { tags: ['Bloating'] },
    '2026-01-20': { tags: ['Bloating'] },
    '2026-01-21': { tags: ['Bloating'] },
    '2026-01-22': { tags: [] },
    '2026-01-23': { water: 4 }
  };
  const patterns = smartPatternsFromLogs(logs, ['2026-01-01', '2026-01-29']);

  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].type, 'symptom-phase');
  assert.equal(patterns[0].count, 6);
  assert.match(patterns[0].text, /5 of 6 luteal-phase days with symptom fields recorded, compared with 1 of 6/);
});

test('water-only historical logs do not create a symptom pattern', () => {
  const logs = {};
  for (let d = 1; d <= 28; d += 1) {
    logs['2026-01-' + String(d).padStart(2, '0')] = { water: 4 };
  }

  assert.equal(smartPatternsFromLogs(logs, ['2026-01-01', '2026-01-29']).length, 0);
});

test('custom symptom rates count only custom symptom observations', () => {
  const logs = {
    '2026-01-01': { customSx: ['Mood swings'] },
    '2026-01-02': { customSx: [] },
    '2026-01-03': { customSx: [] },
    '2026-01-04': { customSx: [] },
    '2026-01-05': { customSx: [] },
    '2026-01-17': { customSx: ['Mood swings'] },
    '2026-01-18': { customSx: ['Mood swings'] },
    '2026-01-19': { customSx: ['Mood swings'] },
    '2026-01-20': { customSx: ['Mood swings'] },
    '2026-01-21': { customSx: ['Mood swings'] }
  };
  const patterns = smartPatternsFromLogs(logs, ['2026-01-01', '2026-01-29']);

  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].type, 'symptom-phase');
  assert.equal(patterns[0].count, 6);
  assert.match(patterns[0].text, /5 of 5 luteal-phase days with symptom fields recorded, compared with 1 of 5/);
});

test('overlapping symptom sources require every relevant source to be recorded', () => {
  const logs = {
    '2026-01-01': { tags: ['Bloating'], customSx: ['Bloating'] },
    '2026-01-02': { tags: [], customSx: [] },
    '2026-01-03': { tags: [], customSx: [] },
    '2026-01-04': { tags: [], customSx: [] },
    '2026-01-05': { tags: [], customSx: [] },
    '2026-01-06': { tags: [], customSx: [] },
    '2026-01-07': { tags: ['Bloating'] },
    '2026-01-08': { customSx: ['Bloating'] },
    '2026-01-17': { tags: ['Bloating'], customSx: ['Bloating'] },
    '2026-01-18': { tags: ['Bloating'], customSx: ['Bloating'] },
    '2026-01-19': { tags: ['Bloating'], customSx: ['Bloating'] },
    '2026-01-20': { tags: ['Bloating'], customSx: ['Bloating'] },
    '2026-01-21': { tags: ['Bloating'], customSx: ['Bloating'] },
    '2026-01-22': { tags: [], customSx: [] },
    '2026-01-23': { tags: ['Bloating'] },
    '2026-01-24': { tags: [] },
    '2026-01-25': { customSx: ['Bloating'] },
    '2026-01-26': { customSx: [] }
  };
  const patterns = smartPatternsFromLogs(logs, ['2026-01-01', '2026-01-29']);

  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].type, 'symptom-phase');
  assert.equal(patterns[0].count, 10);
  assert.match(patterns[0].text, /5 of 6 luteal-phase days with symptom fields recorded, compared with 1 of 6/);
});

test('historical dates use their own cycle context', () => {
  assert.equal(smartHistoricalPhaseFor('2026-01-10', starts).phase, 'Follicular');
  assert.equal(smartHistoricalPhaseFor('2026-01-21', starts).phase, 'Luteal');
  assert.equal(smartHistoricalPhaseFor('2026-01-10', starts).completed, true);
  assert.equal(smartHistoricalPhaseFor('2026-04-15', starts).completed, false);
  assert.equal(smartHistoricalPhaseFor('2025-12-31', starts), null);

  const current = smartCurrentCycleFromHistory(starts, '2026-04-15');
  assert.notEqual(
    smartHistoricalPhaseFor('2026-01-10', starts).phase,
    current.phase
  );
});

test('existing log records remain unchanged', () => {
  const logs = {
    '2026-01-01': { flow: 'medium', sleep: 6, mood: 3, energy: 3, tags: ['Cramps'], customSx: [], water: 4 },
    '2026-01-02': { sleep: 8, mood: 4, energy: 4, tags: [], exercise: 'Walk', exMin: 30 }
  };
  const before = JSON.stringify(logs);

  smartPatternsFromLogs(logs, starts);
  smartHistoricalPhaseFor('2026-01-01', starts);

  assert.equal(JSON.stringify(logs), before);
});

test('existing application integration points and legacy helpers remain intact', () => {
  const legacy = load();
  assert.equal(legacy.phaseInfo(10, 28).k, 'Follicular');
  assert.equal(typeof legacy.mergeDocs, 'function');
  assert.equal(typeof legacy.validateBackup, 'function');

  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  ['function sbSignIn', 'function logout', 'function dayLog', 'function starts',
   'function cycleStats', 'function phaseNow', 'function insights'].forEach(fn => {
    assert.ok(html.includes(fn), fn + ' should remain present');
  });
  assert.ok(!/https:\/\/api\.openai\.com|openai\.com|anthropic\.com/i.test(html));
});
