/*
# Fix security issues with handle_new_user function

## Problem
The `public.handle_new_user()` function is a SECURITY DEFINER trigger function
that runs during user creation. It was executable by `anon` and `authenticated`
roles via `/rest/v1/rpc/handle_new_user`, allowing anyone to invoke it directly.

## Fix
Revoke EXECUTE permission from `anon`, `authenticated`, and `PUBLIC` roles.
Triggers execute as the function owner, not the calling role, so these roles
never need direct EXECUTE permission.

## Security changes
- REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon
- REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated
- REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
