-- Fix "Database error saving new user" by making handle_new_user SECURITY DEFINER
-- so it can bypass RLS when inserting into profiles during user creation.
-- Also restore the Twitch field population logic and keep search_path pinned.

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
$$;

-- The trigger runs as the function owner (postgres/supabase_admin), so anon and
-- authenticated never need direct EXECUTE. Exposing it allowed anyone to call
-- /rest/v1/rpc/handle_new_user directly, which is a security risk.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
