/*
# Create twitch_eventsub_subscriptions table + insert_auction_bid RPC

1. New Tables
- `twitch_eventsub_subscriptions`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, FK to auth.users with CASCADE delete)
  - `subscription_id` (text, not null — Twitch EventSub subscription ID)
  - `subscription_type` (text, not null — e.g. 'channel.channel_points_custom_reward_redemption.add')
  - `status` (text, not null — 'enabled', 'pending', 'disabled')
  - `created_at` (timestamptz, default now())
2. New Functions
- `insert_auction_bid(p_twitch_user_id, p_twitch_username, p_lot_id, p_lot_name, p_amount, p_input_text, p_matched, p_redemption_id)`
  - SECURITY DEFINER function that inserts a row into `auction_bids` on behalf of a user identified by their Twitch user ID.
  - Looks up the user_id from `profiles.twitch_id`.
  - Deduplicates by `redemption_id` using ON CONFLICT.
  - Returns the inserted row.
3. Security
- Enable RLS on `twitch_eventsub_subscriptions`.
- Owner-scoped CRUD.
- `insert_auction_bid` is SECURITY DEFINER, callable by `authenticated` and `anon` (the edge function uses the service role key which bypasses RLS, but we also grant anon for flexibility).
4. Notes
- The `insert_auction_bid` function allows the webhook edge function to insert bids without a user session by looking up the user from their Twitch ID.
*/

CREATE TABLE IF NOT EXISTS twitch_eventsub_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id text NOT NULL,
  subscription_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE twitch_eventsub_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_eventsub_subs" ON twitch_eventsub_subscriptions;
CREATE POLICY "select_own_eventsub_subs"
ON twitch_eventsub_subscriptions FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_eventsub_subs" ON twitch_eventsub_subscriptions;
CREATE POLICY "insert_own_eventsub_subs"
ON twitch_eventsub_subscriptions FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_eventsub_subs" ON twitch_eventsub_subscriptions;
CREATE POLICY "update_own_eventsub_subs"
ON twitch_eventsub_subscriptions FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_eventsub_subs" ON twitch_eventsub_subscriptions;
CREATE POLICY "delete_own_eventsub_subs"
ON twitch_eventsub_subscriptions FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eventsub_sub_id ON twitch_eventsub_subscriptions (subscription_id);
CREATE INDEX IF NOT EXISTS idx_eventsub_user_id ON twitch_eventsub_subscriptions (user_id);

-- SECURITY DEFINER function to insert an auction bid from a Twitch webhook
-- The edge function calls this with the service role key to bypass RLS.
CREATE OR REPLACE FUNCTION insert_auction_bid(
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
  v_user_id uuid;
  v_bid_id uuid;
BEGIN
  -- Look up the Supabase user by their Twitch ID
  SELECT id INTO v_user_id FROM profiles WHERE twitch_id = p_twitch_user_id LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Insert with deduplication on redemption_id
  INSERT INTO auction_bids (user_id, twitch_user_id, twitch_username, lot_id, lot_name, amount, input_text, matched, redemption_id)
  VALUES (v_user_id, p_twitch_user_id, p_twitch_username, p_lot_id, p_lot_name, p_amount, p_input_text, p_matched, p_redemption_id)
  ON CONFLICT (redemption_id) WHERE redemption_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_bid_id;

  RETURN v_bid_id;
END;
$$;

-- Grant execute to anon (edge function uses service role key which bypasses RLS,
-- but granting anon as well for flexibility)
GRANT EXECUTE ON FUNCTION insert_auction_bid TO anon, authenticated;
