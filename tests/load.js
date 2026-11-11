const fs = require('fs');
const path = require('path');
const vm = require('vm');

function extract(src, name) {
  const begin = '// @test-begin ' + name;
  const end = '// @test-end ' + name;
  const i = src.indexOf(begin);
  const j = src.indexOf(end, i + begin.length);
  if (i < 0 || j < 0) throw new Error('marker not found: ' + name);
  return src.slice(i + begin.length, j).trim();
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function load() {
  const sandbox = {
    console,
    Date,
    JSON,
    Math,
    Map,
    Set,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    Promise,
    Intl,
    encodeURIComponent
  };
  sandbox.blank = function blank() {
    return { p: {}, logs: {}, tasks: [], done: {}, meals: {}, journal: [], plan: {}, games: {}, cons: true, rem: { on: false, time: '20:00' } };
  };
  sandbox.TAGS = ['Acne','Hair changes','Bloating','Cramps','Fatigue','Cravings','Headache','Low mood','Anxious','Breast tenderness'];
  sandbox.D = { p: {} };
  sandbox.RO = false;
  sandbox.save = function save() {};
  sandbox.ownName = function ownName() { return ''; };

  const exportsByName = {
    esc: ['E'],
    sync: ['isPlainObject', 'mergeDocs', 'chooseLoginDoc'],
    roWho: ['roWho'],
    sxmig: ['migrateCustomSymptoms'],
    backup: ['makeBackup', 'validateBackup'],
    phases: ['phaseInfo'],
    smart: ['smartPredictionHistory', 'smartCurrentCycle', 'smartCurrentCycleFromHistory', 'smartHistoricalPhaseFor', 'smartPatternsFromLogs', 'smartInsightsHTML', 'smartPatternsHTML', 'smartPhaseInsight', 'smartProgress', 'smartInsightsExtras', 'dashboardCycle']
  };
  for (const name of ['phases', 'esc', 'sync', 'roWho', 'sxmig', 'backup', 'smart']) {
    const code = extract(html, name);
    const names = exportsByName[name];
    vm.runInNewContext(code + `\nObject.assign(globalThis, {${names.join(', ')}})`, sandbox, { filename: name + '.js' });
  }
  return sandbox;
}

module.exports = { load };
