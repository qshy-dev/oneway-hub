-- Switch increment_win_count from SECURITY DEFINER to SECURITY INVOKER
-- so the caller's RLS policies on user_known_users apply.
-- The function only updates rows WHERE user_id = p_user_id, and RLS
-- ensures authenticated users can only touch their own rows.
CREATE OR REPLACE FUNCTION public.increment_win_count(p_user_id uuid, p_username text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.user_known_users
  SET win_count = win_count + 1
  WHERE user_id = p_user_id AND username = p_username;
END;
$function$;

-- Revoke EXECUTE from anon (unauthenticated) and public; keep for authenticated + service_role
REVOKE EXECUTE ON FUNCTION public.increment_win_count(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_win_count(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_win_count(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_win_count(uuid, text) TO service_role;
