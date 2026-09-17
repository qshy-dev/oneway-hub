/*
# Fix auction bid ownership for channel-point redemptions

## Problem
The `insert_auction_bid` RPC looked up the *bidder's* Supabase user from
`profiles.twitch_id`, but the webhook event identifies the *broadcaster* (the
streamer running the auction) via `broadcaster_user_id`. As a result, bids were
written with `user_id` set to the chatter (or not inserted at all if the chatter
had never signed in), so the frontend's realtime subscription filtered by the
streamer's `user.id` never saw them.

## Fix
Create `insert_auction_bid_for_streamer(p_streamer_twitch_id, ...)`. The webhook
edge function will pass the broadcaster's Twitch ID, and the RPC resolves the
streamer's Supabase `user_id` to use as the row owner. This keeps RLS intact
and makes realtime delivery work.
*/

CREATE OR REPLACE FUNCTION public.insert_auction_bid_for_streamer(
  p_streamer_twitch_id text,
  p_twitch_user_id text,
  p_twitch_username text,
  p_lot_id text,
  p_lot_name text,
  p_amount integer,
  p_input_text text,
  p_matched boolean DEFAULT false,
  p_redemption_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streamer_user_id uuid;
  v_bid_id uuid;
BEGIN
  SELECT id INTO v_streamer_user_id FROM profiles WHERE twitch_id = p_streamer_twitch_id LIMIT 1;
  IF v_streamer_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO auction_bids (user_id, twitch_user_id, twitch_username, lot_id, lot_name, amount, input_text, matched, redemption_id)
  VALUES (v_streamer_user_id, p_twitch_user_id, p_twitch_username, p_lot_id, p_lot_name, p_amount, p_input_text, p_matched, p_redemption_id)
  ON CONFLICT (redemption_id) WHERE redemption_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_bid_id;

  RETURN v_bid_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_auction_bid_for_streamer(text, text, text, text, text, integer, text, boolean, text) TO anon, authenticated, service_role;