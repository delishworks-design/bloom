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
  sandbox.ST = { _m:{}, get(k){return Object.prototype.hasOwnProperty.call(this._m,k)?this._m[k]:null}, set(k,v){this._m[k]=String(v)}, del(k){delete this._m[k]} };
  sandbox.localStorage = { _m:{}, getItem(k){return Object.prototype.hasOwnProperty.call(this._m,k)?this._m[k]:null}, setItem(k,v){this._m[k]=String(v); this[k]=String(v)}, removeItem(k){delete this._m[k]; delete this[k]}, get length(){return Object.keys(this._m).length}, key(i){return Object.keys(this._m)[i]||null}, clear(){for(const k of Object.keys(this._m))delete this[k]; this._m={}} };
  sandbox.RO=false; sandbox.ROcloud=false; sandbox.roHash=''; sandbox.user=null; sandbox.sbLastPush=''; sandbox.sbRev=0; sandbox.view='cycle'; sandbox.tab=''; sandbox.onbStep=0; sandbox.calM='2026-01-01';
  sandbox.clearSession=function(){}; sandbox.setRoleFlag=function(){}; sandbox.today=function(){return '2026-01-20'}; sandbox.reminderCancel=function(){}; sandbox.sb=null; sandbox.sbUser=null; sandbox.cloudTimer=null; sandbox.hideUpdateBanner=function(){}; sandbox.authView=function(){};

  const exportsByName = {
    esc: ['E'],
    sync: ['isPlainObject', 'mergeDocs', 'chooseLoginDoc'],
    roWho: ['roWho'],
    sxmig: ['migrateCustomSymptoms'],
    backup: ['makeBackup', 'validateBackup'],
    phases: ['phaseInfo'],
    smart: ['smartPredictionHistory', 'smartCurrentCycle', 'smartCurrentCycleFromHistory', 'smartHistoricalPhaseFor', 'smartPatternsFromLogs', 'smartInsightsHTML', 'smartPatternsHTML', 'smartPhaseInsight', 'smartProgress', 'smartInsightsExtras', 'smartComingUp', 'smartWeekCompare', 'smartActiveGoals', 'smartGoalFocus', 'smartWeekFacts', 'smartWeekTemplate', 'smartWeekValidate', 'smartWeekAllowedNumbers', 'smartWeekHTML', 'smartWeekCompareHTML', 'smartComingUpHTML', 'dashboardCycle', 'clearLegacySmartAIStorage', 'smartCTAFor', 'smartCTALabel', 'smartKnowledgeFor', 'smartWeekVariantIndex', 'smartEvidenceRegistry'],
    auth: ['logout', 'wipeLocalData'],
    ownmode: ['seedOwnDoc']
  };
  for (const name of ['phases', 'esc', 'sync', 'roWho', 'sxmig', 'backup', 'smart', 'auth', 'ownmode']) {
    let code;
    try{ code = extract(html, name); }catch(e){ if(name==='auth') continue; throw e; }
    const names = exportsByName[name];
    vm.runInNewContext(code + `\nObject.assign(globalThis, {${names.join(', ')}})`, sandbox, { filename: name + '.js' });
  }
  return sandbox;
}

module.exports = { load };
