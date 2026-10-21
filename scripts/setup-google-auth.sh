#!/usr/bin/env bash
# Enable Google (Gmail) sign-in for the Bloom Supabase project.
#
#   ./scripts/setup-google-auth.sh <google-client-id> <google-google-client-secret>
#
# Needs a Supabase access token in SUPABASE_ACCESS_TOKEN and a Google OAuth client
# from Google Cloud Console (APIs & Services → Credentials → OAuth client ID → Web).
set -euo pipefail

PROJECT_REF="${PROJECT_REF:-vggaswbjsmyvfheofnnj}"
CLIENT_ID="${1:-}"
CLIENT_SECRET="${2:-}"

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  echo "usage: $0 <google-client-id> <google-client-secret>" >&2
  exit 1
fi
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "SUPABASE_ACCESS_TOKEN is not set" >&2
  exit 1
fi

curl -sS -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
        \"external\": {
          \"google\": {
            \"enabled\": true,
            \"client_id\": \"${CLIENT_ID}\",
            \"secret\": \"${CLIENT_SECRET}\",
            \"skip_nonce_check\": false
          }
        }
      }" >/dev/null

echo "Google sign-in enabled for ${PROJECT_REF}."
echo "Now add your app URL to Authentication → URL Configuration → Redirect URLs."
