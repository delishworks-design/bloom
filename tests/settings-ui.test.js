const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('Your data card is collapsed by default', () => {
  assert.match(html, /<details class="card" id="dataCard">/);
  assert.match(html, /<summary class="card-h data-sum">/);
  assert.match(html, /id="sDel"/);
  assert.match(html, /id="sDelAcct"/);
  assert.match(html, /id="sExp"/);
  assert.match(html, /id="sImp"/);
});

test('profile and follower avatars open a fullscreen viewer', () => {
  assert.match(html, /function openAvatarFull\(src\)/);
  assert.match(html, /closest\('\[data-avatar-full\]'\)/);
  assert.match(html, /data-avatar-full="\$\{E\(D\.p\.avatar\)\}"/);
  assert.match(html, /data-avatar-full="\$\{E\(av\)\}" style="width:56px/);
  assert.match(html, /\.avatar-full\{position:fixed;inset:0/);
});

test('Your data is the last card and Delete my account is its last action', () => {
  assert.ok(html.indexOf('id="dataCard"') > html.indexOf('id="chkUp"'));
  const data = html.slice(html.indexOf('Manage or remove your data'));
  assert.ok(data.indexOf('id="sDelAcct"') > data.indexOf('id="sExp"'));
  assert.ok(data.indexOf('id="sDelAcct"') > data.indexOf('id="sImp"'));
  assert.ok(data.indexOf('id="sDelAcct"') > data.indexOf('id="sDel"'));
});

test('only profile-page avatars are fullscreen, not header avatars', () => {
  assert.match(html, /roAvatarHTML\(44,true\)/);
  assert.match(html, /avatarHTML\(44,true\)/);
  assert.match(html, /avatarHTML\(192\)/);
  assert.ok(html.includes('noFull?\'\''));
});

test('fullscreen avatar is centered and locks background scroll', () => {
  assert.match(html, /\.avatar-full\{position:fixed;inset:0;z-index:280;/);
  assert.match(html, /display:flex;align-items:center;justify-content:center;padding:24px;overflow:hidden/);
  assert.match(html, /max-width:min\(100%,92vw\);max-height:min\(100%,86vh\)/);
  assert.match(html, /html\.avatar-open,html\.avatar-open body\{overflow:hidden/);
  assert.match(html, /classList\.add\('avatar-open'\)/);
});
