-- Public profiles contain presentation data only. OAuth tokens stay owner/server-only.
DROP POLICY IF EXISTS "select_all_profiles" ON public.profiles;
REVOKE UPDATE ON public.profiles FROM authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_twitch_username_lower_unique
  ON public.profiles (lower(twitch_username))
  WHERE twitch_username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_public_profile(
  p_username text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(p) - 'twitch_access_token'
  FROM public.profiles p
  WHERE
    (p_user_id IS NOT NULL AND p.id = p_user_id)
    OR
    (p_user_id IS NULL AND p_username IS NOT NULL AND lower(p.twitch_username) = lower(p_username))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_profile(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_own_twitch_access_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_token IS NULL OR length(p_token) < 10 OR length(p_token) > 4096 THEN
    RAISE EXCEPTION 'invalid token';
  END IF;
  UPDATE public.profiles SET twitch_access_token = p_token WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.set_own_twitch_access_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_own_twitch_access_token(text) TO authenticated;

REVOKE ALL ON FUNCTION public.insert_auction_bid_for_streamer(text, text, text, text, text, integer, text, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_auction_bid_for_streamer(text, text, text, text, text, integer, text, boolean, text) TO service_role;
