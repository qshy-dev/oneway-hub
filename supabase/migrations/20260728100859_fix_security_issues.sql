-- Fix 1 & 2: Revoke EXECUTE on handle_new_user from anon and authenticated.
-- The function is a trigger (SECURITY DEFINER) that runs during user creation.
-- Triggers execute as the function owner, not as the calling role, so anon/authenticated
-- never need direct EXECUTE permission. Exposing it via /rest/v1/rpc allowed anyone
-- to invoke it directly, which is a security risk.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- Also revoke from PUBLIC role (covers any role not explicitly granted)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
