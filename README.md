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

| What | Where |
|---|---|
| Project | `vggaswbjsmyvfheofnnj` (`Selah`, Southeast Asia) |
| Tables | `bloom_profiles`, `bloom_data`, `bloom_partners` |
| Functions | `bloom_create_partner_code`, `bloom_redeem_partner_code`, `bloom_revoke_partner_codes`, `bloom_is_partner` |
| Schema | [`supabase/migrations/20261021000000_bloom.sql`](supabase/migrations/20261021000000_bloom.sql) |

Row Level Security is on for every table:

- you can read and write only your own profile and data
- a partner who has redeemed your code can **read** your profile and data, and nothing else
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
2. Share the 6-character code with your partner
3. They pick **Partner** on the login screen, sign in, and enter the code
4. They get a read-only view: no logging, no notes, nothing editable — and it updates as you log

Revoking deletes the code immediately and drops the partner's access.

## Gmail / Google sign-in

Not enabled on the project yet — it needs one OAuth client from Google Cloud. Once you have a
client ID and secret:

```sh
./scripts/setup-google-auth.sh <client-id> <client-secret>
```

Then add the app's URL to **Authentication → URL Configuration → Redirect URLs** in the Supabase
dashboard. The **Continue with Google** button appears automatically once the provider is on.

## Privacy

Notes stay in your browser and, if you sign in, in your own Supabase account. Nothing is sent to
any third party. This is not a medical service and does not diagnose anything.

## Licence

MIT
