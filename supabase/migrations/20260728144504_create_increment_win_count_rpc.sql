/*
# Create increment_win_count RPC function

## Purpose
Atomically increments the win_count for a given user (streamer) and username.
Used when a giveaway winner is confirmed as answered.

## Function
- `increment_win_count(p_user_id uuid, p_username text) RETURNS void`
- SECURITY DEFINER so it can run with elevated privileges
- Increments win_count by 1 for the matching row in user_known_users

## Security
- SECURITY DEFINER with search_path = public
- Only increments the row matching both p_user_id and p_username
*/

CREATE OR REPLACE FUNCTION public.increment_win_count(p_user_id uuid, p_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_known_users
  SET win_count = win_count + 1
  WHERE user_id = p_user_id AND username = p_username;
END;
$$;
