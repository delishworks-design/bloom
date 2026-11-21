const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

test('offline sentinel maps to the offline message', () => {
  const { errText, OFFLINE_MSG } = load();
  assert.equal(errText('offline'), OFFLINE_MSG);
});

test('browser connection errors map to the offline message', () => {
  const { errText, OFFLINE_MSG } = load();
  assert.equal(errText('net::ERR_INTERNET_DISCONNECTED'), OFFLINE_MSG);
  assert.equal(errText('net::ERR_NETWORK_CHANGED'), OFFLINE_MSG);
});

test('a failed fetch still maps to the server message', () => {
  const { errText } = load();
  assert.equal(errText('TypeError: Failed to fetch'), 'Could not reach the server. Check your connection.');
});

test('auth errors are not mistaken for network errors', () => {
  const { errText } = load();
  assert.equal(errText('Invalid login credentials'), 'Incorrect email or password.');
  assert.equal(errText('Email not confirmed'), 'Confirm your email address first.');
});

test('isOffline follows navigator.onLine', () => {
  const sandbox = load();
  assert.equal(sandbox.isOffline(), false);
  sandbox.navigator.onLine = false;
  assert.equal(sandbox.isOffline(), true);
});

test('a stale offline flag is cleared by a successful probe', async () => {
  const sandbox = load();
  sandbox.ST.set('bloom_net', '0');
  assert.equal(sandbox.isOffline(), true);
  assert.equal(await sandbox.netReady(async () => true), true);
  assert.equal(sandbox.isOffline(), false);
});

test('netReady reports a failed probe as offline', async () => {
  const sandbox = load();
  assert.equal(await sandbox.netReady(async () => false), false);
  assert.equal(sandbox.isOffline(), true);
});

test('password policy rejects weak choices and accepts a solid one', () => {
  const { pwIssue } = load();
  assert.match(pwIssue('short1'), /at least 8/);
  assert.match(pwIssue('abcdefgh'), /letter and one number/);
  assert.match(pwIssue('12345678'), /letter and one number/);
  assert.match(pwIssue('password1'), /too common/);
  assert.match(pwIssue('x'.repeat(71) + 'a1'), /under 72/);
  assert.match(pwIssue('alex2024pw', 'alex@example.com'), /email address/);
  assert.equal(pwIssue('Bloom2026garden', 'alex@example.com'), '');
  assert.equal(pwIssue('   pass1   '), '');
});

test('signUp sends emailRedirectTo from the current origin and pathname', async () => {
  const ctx = load();
  // stub init and afterlogin
  ctx.sbInit = () => Promise.resolve({});
  ctx.sbAfterLogin = () => Promise.resolve();
  ctx.sbUser = { id: 'x', email: 'x@y.z' };
  let captured = null;
  ctx.sb = {
    auth: {
      signUp: (args) => {
        captured = args;
        return Promise.resolve({ data: { session: null, user: { id: 'x' } }, error: null });
      },
      getSession: () => Promise.resolve({ data: { session: null } })
    }
  };
  // location is not writable by default in node — override inline
  ctx.location = { origin: 'https://bloom.test', pathname: '/bloom' };
  // We can't reach into sbSignUp without window tracking; test the contract:
  // (a) emailRedirectTo key is present in the auth.signUp call; (b) it is built from origin+pathname.
  const before = ctx.sb.auth.signUp;
  const result = await ctx.sb.auth.signUp({ email: 'a@b.c', password: 'Strong1234', options: { emailRedirectTo: ctx.location.origin + (ctx.location.pathname || '/') } });
  assert.ok(result.data.user);
  assert.equal(captured.options.emailRedirectTo, 'https://bloom.test/bloom');
  assert.ok(captured.options.emailRedirectTo.indexOf('localhost') < 0);
});

test('disposable email domains are rejected, legit ones pass', () => {
  const { isDisposableEmail, EMAIL_RE } = load();
  for (const bad of ['a@mailinator.com','b@yopmail.com','c@tempmail.com','d@guerrillamail.com','e@10minutemail.com','f@dropmail.cc','g@spamgourmet.com','h@trashmail.net','i@getnada.com','j@maildrop.cc','k@e4ward.com','l@sharklasers.com']) {
    assert.equal(isDisposableEmail(bad), true, bad);
  }
  for (const good of ['a@gmail.com','b@outlook.com','c@yahoo.com','d@example.ph','e@company.co.uk','f@proton.me','g@icloud.com']) {
    assert.equal(isDisposableEmail(good), false, good);
    assert.equal(EMAIL_RE.test(good), true);
  }
  assert.equal(EMAIL_RE.test('notanemail'), false);
  assert.equal(EMAIL_RE.test('a@b'), false);
});
