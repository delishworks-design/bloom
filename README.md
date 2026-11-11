# Bloom · PMOS Planner

A gentle, offline-first planner for PCOS / PMOS. One file, no build step — open `index.html`
in any browser.

```
open index.html
```

## What it does

- **Cycle** — a ring of your cycle days, your current phase, mood/energy tracking, water meter,
  monthly calendar, and a weekly view
- **Planner** — daily tasks, meals with a weekly plan and grocery list, and a private journal
- **Insights** — mood, energy, sleep, symptom frequency, habit completion and cycle length
- **Learn** — plain-language articles about PMOS/PCOS, plus food tips and everyday tips
- **Partner view** — share a read-only view of your logs with a partner using a sync code

## Accounts and sync (Supabase)

The app is **offline-first**: everything is written to `localStorage` immediately, and the app works
with no network at all. When you sign in, the same data is mirrored to Supabase so it follows you
to another device.

Sign-up uses an email address and password, and new accounts must confirm their email before
signing in. You can delete your account and all synced data from Settings; a linked partner loses
access.

| What | Where |
|---|---|
| Project | `vggaswbjsmyvfheofnnj` (`Selah`, Southeast Asia) |
 | Tables | `bloom_profiles`, `bloom_data`, `bloom_partners`, `bloom_redeem_attempts`, `bloom_shared` |
 | Functions | `bloom_create_partner_code`, `bloom_make_shared`, `bloom_redeem_partner_code`, `bloom_revoke_partner_codes`, `bloom_leave_pairing`, `bloom_sync_shared`, `bloom_owns_partner`, `bloom_is_partner`, `bloom_unshare`, `bloom_delete_account` |
| Schema | [`supabase/migrations/20261021000000_bloom.sql`](supabase/migrations/20261021000000_bloom.sql) |

Row Level Security is on for every table:

- you can read and write only your own profile and data
- a partner who has redeemed your code reads only a filtered copy (bloom_shared), never your private data; see "Partner privacy" below
- partner codes are read/written through `security definer` functions so a raw code can never be
  enumerated by the anon key

### Applying the schema

```sh
supabase login
supabase link --project-ref vggaswbjsmyvfheofnnj
supabase db push
```

## Partner sharing

1. Profile → **Partner sync** → **Create sync code**
2. Share the 8-character code with your partner
3. They pick **Partner** on the login screen, sign in, and enter the code
4. They get a read-only view: no logging, no notes, nothing editable — and it updates as you log

Codes are generated on the server and expire after 24 hours if not claimed.

Revoking deletes the code immediately and drops the partner's access.

## Partner privacy

Partners do not read the owner's private `bloom_data` doc directly. They read
`bloom_shared`, a server-filtered copy created by `bloom_make_shared()` and kept
current by the `bloom_sync_shared` trigger.

Shared with partners:

- top level: `savedAt`, `p`, `logs`, `tasks`, `done`, `meals`, `plan`
- `p` keys: `name`, `avatar`, `avatarCrop`, `bud`, `waterGoal`
- log fields: `mood`, `flow`, `water`, `tags`, `sleep`, `exMin`, `energy`

Deleting the owner's `bloom_data` row also deletes the shared copy.

Never shared: `journal`, `rem`, `partner`, `games`, `cons`, `seedClean`, all
other `p` keys, and log fields such as `note`, `sidefx`, and `weight`.

Phase 2 is applied: partners can no longer read bloom_data directly; only the owner can. Partners read bloom_shared only.

## Google sign-in

Web uses the OAuth redirect via Supabase `signInWithOAuth` (Google). The Android app uses native Google Sign-In via `@capgo/capacitor-social-login` and `signInWithIdToken` (to avoid blocked WebView OAuth and to return to the app). Email/password remains available.

## Auth setup

Password reset uses a 6-digit email code (no deep links).

1. In the Supabase dashboard, go to **Authentication → Email Templates**.
2. Open **Reset Password**.
3. Set the subject to `Your Bloom reset code`.
4. Set the body to:

```html
<h2>Reset your Bloom password</h2>
<p>Your code:</p>
<h1>{{ .Token }}</h1>
<p>If you did not ask for this, ignore this email.</p>
```

5. The built-in email service is rate-limited and is only meant for testing. Configure custom SMTP under **Authentication → SMTP Settings** for production email.
6. Set the email OTP expiry to 15 minutes (the code is 6 digits).
7. Email confirmation is enabled: new accounts must confirm their address before signing in.
8. Account deletion is available in Settings and removes the sign-in account and all synced data.

## Development

Run the local checks with:

```sh
node --test tests/*.test.js
```

See [docs/auth-setup.md](docs/auth-setup.md) for the email/password reset setup.

## Privacy

Your notes are stored on this device. If you sign in, they are also stored in the Bloom cloud database (Supabase), protected by row-level security. A partner you pair with reads only a filtered copy. You can delete your account and its synced data from Settings at any time. The app checks GitHub for updates. There are no ads, analytics or tracking. This is not a medical service and does not diagnose anything.

## Fonts

Playfair Display and Sansita are SIL Open Font License (OFL). They are embedded in `index.html` as base64 woff2 data URIs, so Bloom makes no request to Google Fonts.

## Deployed

- GitHub: `delishworks-design/bloom` (public)
- Supabase project: `vggaswbjsmyvfheofnnj`

## Licence

MIT
