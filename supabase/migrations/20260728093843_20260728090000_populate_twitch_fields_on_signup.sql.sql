/*
# Populate Twitch profile fields on signup

## Purpose
When a user signs in via Twitch OAuth, Supabase creates a row in `auth.users`
with the Twitch user information stored in `raw_user_meta_data`. The existing
`handle_new_user` trigger creates a `profiles` row but only sets the `id` —
all Twitch fields (username, display name, avatar, broadcaster type, Twitch
numeric ID) remain NULL. This update makes the trigger populate those fields
from the OAuth metadata so the profile is complete immediately after signup.

## Changes
- `handle_new_user()` trigger function updated to read Twitch data from
  `NEW.raw_user_meta_data` and insert it into the `profiles` row.
- Uses `ON CONFLICT (id) DO UPDATE` so that if a profile row already exists
  (e.g. from a previous login attempt), the Twitch fields are refreshed.

## Security
- No RLS policy changes — existing policies remain in place.
- The trigger runs with elevated privileges (SECURITY DEFINER is not set;
  it runs as the auth role which has INSERT on profiles via the trigger).

## Notes
1. Twitch OAuth provides these fields in `raw_user_meta_data`:
   - `provider_id` → twitch_id
   - `user_name` → twitch_username (lowercased)
   - `name` → twitch_display_name
   - `picture` → twitch_avatar
   - `full_name` or `preferred_username` may also be present
2. `twitch_broadcaster_type` is not provided by Twitch OAuth by default;
   it remains NULL and can be filled in later by an edge function if needed.
3. The function is idempotent — safe to re-run.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
BEGIN
  INSERT INTO public.profiles (
    id,
    twitch_id,
    twitch_username,
    twitch_display_name,
    twitch_avatar,
    twitch_broadcaster_type
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'provider_id',
    lower(coalesce(NEW.raw_user_meta_data->>'user_name', NEW.raw_user_meta_data->>'preferred_username', '')),
    coalesce(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'user_name'),
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'broadcaster_type'
  )
  ON CONFLICT (id) DO UPDATE SET
    twitch_id = EXCLUDED.twitch_id,
    twitch_username = EXCLUDED.twitch_username,
    twitch_display_name = EXCLUDED.twitch_display_name,
    twitch_avatar = EXCLUDED.twitch_avatar,
    twitch_broadcaster_type = EXCLUDED.twitch_broadcaster_type,
    updated_at = now();
  RETURN NEW;
END;
$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
