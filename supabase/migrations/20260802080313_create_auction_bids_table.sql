/*
# Create auction_bids table for channel-point redemptions

1. New Tables
- `auction_bids`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), FK to auth.users with CASCADE delete)
  - `twitch_user_id` (text, nullable — the Twitch user ID of the bidder)
  - `twitch_username` (text, nullable — the Twitch username of the bidder)
  - `lot_id` (text, nullable — matched lot ID in the auction, null if no match)
  - `lot_name` (text, nullable — matched lot name)
  - `amount` (integer, not null — channel points spent)
  - `input_text` (text, not null — the text the user entered when redeeming the reward)
  - `matched` (boolean, default false — whether a lot was matched)
  - `redemption_id` (text, nullable — Twitch redemption ID for deduplication)
  - `created_at` (timestamptz, default now())
2. Security
- Enable RLS on `auction_bids`.
- Owner-scoped CRUD: each authenticated user can only access their own rows.
3. Notes
- Unique constraint on `redemption_id` to prevent duplicate bids from Twitch webhook retries.
- Index on `user_id` for efficient per-user queries.
- Realtime is enabled on this table so the frontend can subscribe to new bids.
*/

CREATE TABLE IF NOT EXISTS auction_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  twitch_user_id text,
  twitch_username text,
  lot_id text,
  lot_name text,
  amount integer NOT NULL,
  input_text text NOT NULL,
  matched boolean NOT NULL DEFAULT false,
  redemption_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_auction_bids" ON auction_bids;
CREATE POLICY "select_own_auction_bids"
ON auction_bids FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_auction_bids" ON auction_bids;
CREATE POLICY "insert_own_auction_bids"
ON auction_bids FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_auction_bids" ON auction_bids;
CREATE POLICY "update_own_auction_bids"
ON auction_bids FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_auction_bids" ON auction_bids;
CREATE POLICY "delete_own_auction_bids"
ON auction_bids FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_bids_redemption_id
ON auction_bids (redemption_id)
WHERE redemption_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auction_bids_user_id ON auction_bids (user_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE auction_bids;
