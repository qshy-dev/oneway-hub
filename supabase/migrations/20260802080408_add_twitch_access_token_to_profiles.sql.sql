/*
# Add twitch_access_token column to profiles

1. Modified Tables
- `profiles`
  - Add `twitch_access_token` (text, nullable) — stores the Twitch OAuth provider_token
    captured during sign-in, used to create EventSub subscriptions for channel points.
2. Security
- The column is readable/writable only by the owner (existing RLS policies on profiles already cover this).
3. Notes
- The token is captured client-side from the Supabase session's `provider_token` field
  and saved to the profile via an update query.
- The token has a limited lifetime (~4 hours). If it expires, the user must re-authenticate.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_access_token text;
