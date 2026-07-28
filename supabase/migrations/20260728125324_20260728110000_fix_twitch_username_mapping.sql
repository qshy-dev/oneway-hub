/*
# Fix Twitch username field mapping in handle_new_user trigger

## Problem
The trigger looked for `user_name` and `preferred_username` in
`raw_user_meta_data`, but Twitch OAuth actually provides the login under
`slug` and `nickname`. As a result `twitch_username` was saved as an empty
string, so the profile and home pages showed "@user" instead of the real
username, and the follows edge function received an empty login.

`broadcaster_type` is also nested inside `custom_claims`, not at the top
level — so that field was always NULL too.

## Fix
- Read username from `slug` / `nickname` / `user_name` (in that order).
- Read broadcaster_type from `custom_claims->>'broadcaster_type'`.
- Backfill the existing profile row so current users get correct data.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    lower(coalesce(
      NEW.raw_user_meta_data->>'slug',
      NEW.raw_user_meta_data->>'nickname',
      NEW.raw_user_meta_data->>'user_name',
      NEW.raw_user_meta_data->>'preferred_username',
      ''
    )),
    coalesce(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'nickname',
      NEW.raw_user_meta_data->>'slug'
    ),
    coalesce(
      NEW.raw_user_meta_data->>'picture',
      NEW.raw_user_meta_data->>'avatar_url'
    ),
    NEW.raw_user_meta_data->'custom_claims'->>'broadcaster_type'
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
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;

-- Backfill existing profiles from auth.users metadata
UPDATE public.profiles p
SET
  twitch_username = lower(coalesce(
    u.raw_user_meta_data->>'slug',
    u.raw_user_meta_data->>'nickname',
    u.raw_user_meta_data->>'user_name',
    u.raw_user_meta_data->>'preferred_username',
    p.twitch_username
  )),
  twitch_display_name = coalesce(
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'nickname',
    u.raw_user_meta_data->>'slug',
    p.twitch_display_name
  ),
  twitch_avatar = coalesce(
    u.raw_user_meta_data->>'picture',
    u.raw_user_meta_data->>'avatar_url',
    p.twitch_avatar
  ),
  twitch_broadcaster_type = coalesce(
    u.raw_user_meta_data->'custom_claims'->>'broadcaster_type',
    p.twitch_broadcaster_type
  ),
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND (p.twitch_username IS NULL OR p.twitch_username = '');
