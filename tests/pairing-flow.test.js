const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extract(start, end) {
  const i = html.indexOf(start);
  const j = html.indexOf(end, i + start.length);
  assert.ok(i >= 0 && j > i, 'missing code block: ' + start);
  return html.slice(i, j);
}

function authFlow(overrides) {
  const calls = { after: [], errs: [], rpc: [] };
  const ctx = Object.assign({
    console, Promise, String, Error, Date, JSON,
    setTimeout, clearTimeout,
    errText: m => String(m),
    OFFLINE_MSG: 'offline',
    withTimeout: p => p,
    authRedirectUrl: () => 'https://bloom.test/bloom/',
    sbInit: async () => ctx.sb,
    sbAfterLogin: async u => { calls.after.push(u); },
    sbUser: null,
    sb: null
  }, overrides || {});
  ctx.calls = calls;
  vm.createContext(ctx);
  vm.runInContext(extract('async function sbSignIn', '// ---------- storage'), ctx);
  return { ctx, calls };
}

test('sign-up logs out an old local session and does not resume it', async () => {
  let signOutArg = null;
  const { ctx, calls } = authFlow();
  ctx.sbUser = { id: 'old', email: 'old@example.com' };
  ctx.sb = {
    auth: {
      signOut: async arg => { signOutArg = arg; },
      signUp: async () => ({ data: { session: null, user: { id: 'new' } }, error: null }),
      getSession: async () => ({ data: { session: { user: { id: 'old' } } } })
    }
  };
  const res = await ctx.sbSignUp('new@example.com', 'Bloom2026garden');
  assert.equal(res, 'confirm_pending');
  assert.equal(signOutArg && signOutArg.scope, 'local');
  assert.equal(ctx.sbUser, null);
  assert.equal(calls.after.length, 0, 'must not sign in the previous account');
});

test('sign-in uses the session returned by this request, not a stale getSession', async () => {
  const fresh = { user: { id: 'new', email: 'new@example.com' } };
  const { ctx, calls } = authFlow();
  ctx.sb = {
    auth: {
      signInWithPassword: async () => ({ data: { session: fresh }, error: null }),
      getSession: async () => ({ data: { session: { user: { id: 'old' } } } })
    }
  };
  const res = await ctx.sbSignIn('new@example.com', 'Bloom2026garden');
  assert.equal(res, null);
  assert.equal(ctx.sbUser.id, 'new');
  assert.equal(calls.after.length, 1);
  assert.equal(calls.after[0].id, 'new');
});

function redeemFlow(overrides) {
  const calls = { errs: [], rpc: [], entered: [] };
  const ctx = Object.assign({
    console, Promise, String, Error, Date, JSON,
    setTimeout, clearTimeout,
    withTimeout: p => p,
    pnGet: () => '',
    pnSet: () => {},
    sbUser: null,
    user: null,
    D: { logs: {} },
    reportErr: () => {},
    enterPartnerMode: async (owner, code) => { calls.entered.push([owner, code]); return true; },
    sbInit: async () => ctx.sb,
    sb: null
  }, overrides || {});
  ctx.calls = calls;
  vm.createContext(ctx);
  vm.runInContext(extract('async function redeemCode', "let authPrefill=''"), ctx);
  return { ctx, calls };
}

test('redeem hydrates a restored session instead of saying sign in first', async () => {
  const { ctx, calls } = redeemFlow();
  ctx.sb = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'follower', email: 'p@example.com' } } } }) },
    rpc: async (name, args) => { calls.rpc.push([name, args]); return { data: 'owner-id', error: null }; }
  };
  const ok = await ctx.redeemCode('ABC12345', m => calls.errs.push(m));
  assert.equal(ok, true);
  assert.deepEqual(calls.errs, []);
  assert.equal(ctx.sbUser.id, 'follower');
  assert.equal(calls.rpc[0][0], 'bloom_redeem_partner_code');
  assert.equal(calls.rpc[0][1].p_code, 'ABC12345');
  assert.deepEqual(Array.from(calls.entered[0]), ['owner-id', 'ABC12345']);
});

test('redeem still asks a genuinely signed-out user to sign in', async () => {
  const { ctx, calls } = redeemFlow();
  ctx.sb = {
    auth: { getSession: async () => ({ data: { session: null } }) },
    rpc: async () => { throw new Error('should not run'); }
  };
  const ok = await ctx.redeemCode('ABC12345', m => calls.errs.push(m));
  assert.equal(ok, false);
  assert.match(calls.errs[0], /Sign in first/);
});

test('redeem reports network failure instead of calling the code invalid', async () => {
  const { ctx, calls } = redeemFlow();
  ctx.sb = {
    auth: { getSession: async () => ({ data: { session: null } }) },
    rpc: async () => { throw new Error('Failed to fetch'); }
  };
  ctx.sbUser = { id: 'follower', email: 'p@example.com' };
  const ok = await ctx.redeemCode('ABC12345', m => calls.errs.push(m));
  assert.equal(ok, false);
  assert.match(calls.errs[0], /Could not reach the server/);
});

test('offline partner restore is scoped to the follower who paired', () => {
  const i = html.indexOf('if(!q.ok){');
  const body = html.slice(i, i + 520);
  assert.ok(body.includes("const po=ST.get('bloom_powner')"), 'must read the cached owner');
  assert.ok(body.includes('prevPuid===u.id'), 'must require the same Supabase user');
});
