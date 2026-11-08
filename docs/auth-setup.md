# Auth setup

Bloom password reset uses a 6-digit email code (no deep links). Configure these in the Supabase dashboard.

## Reset Password template

1. Go to **Authentication → Email Templates**.
2. Open **Reset Password**.
3. Set the subject to `Your Bloom reset code`.
4. Set the body to:

```html
<h2>Reset your Bloom password</h2>
<p>Your code:</p>
<h1>{{ .Token }}</h1>
<p>If you did not ask for this, ignore this email.</p>
```

## SMTP

The built-in email service is rate-limited and is meant for testing only. Set up custom SMTP under **Authentication → SMTP Settings** for production email.

## OTP expiry

Shorten the email OTP expiry to about 15 minutes if the dashboard allows it.

## Confirmation emails

Keep confirmation emails enabled.

## Password minimum

The app requires passwords of at least 6 characters. The owner can raise the minimum in Authentication settings.
