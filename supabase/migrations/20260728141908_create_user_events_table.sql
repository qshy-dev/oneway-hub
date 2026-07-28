/*
# Create user_events table for per-user statistics

## Purpose
Stores one row per completed auction or giveaway for each authenticated
Twitch user. The Statistics page reads from this table to display real,
synced data across devices.

## New Tables
- `user_events`
  - `id` (uuid, primary key) — unique event ID
  - `user_id` (uuid, not null, defaults to auth.uid()) — owner, FK to auth.users with CASCADE delete
  - `type` (text, not null) — 'auction' or 'giveaway'
  - `name` (text, nullable) — event name (auction name or giveaway mode label)
  - `data` (jsonb, not null default '{}') — event-specific details:
    - For auctions: { lots_count, total_sum, participants, lot_names }
    - For giveaways: { participants, messages, winner, duration_sec, mode }
  - `created_at` (timestamptz, default now()) — when the event was recorded

## Indexes
- `idx_user_events_user_id` on (user_id, created_at DESC) — fast per-user queries for stats page
- `idx_user_events_type` on (user_id, type) — filter by event type

## Security
- RLS enabled on user_events.
- Each authenticated user can only CRUD their own rows (auth.uid() = user_id).
- user_id defaults to auth.uid() so inserts that omit it still pass the WITH CHECK policy.
- No anonymous access — sign-in required.

## Storage Estimate (1 million users)
- Average ~10 events per user = 10 million rows
- Each row ~300 bytes (UUID 16B + UUID 16B + type ~10B + name ~30B + JSONB ~200B + timestamp 8B + overhead)
- Total: ~3 GB for 10M rows
- Supabase Pro tier includes 8 GB — comfortably fits 1M users with room to grow
- If most users are inactive (0 events), only the profile row exists — no user_events rows
- The table grows linearly with completed events, not with registered users
*/

CREATE TABLE IF NOT EXISTS user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('auction', 'giveaway')),
  name text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- SELECT: users can read only their own events
DROP POLICY IF EXISTS "select_own_events" ON user_events;
CREATE POLICY "select_own_events" ON user_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: users can insert only their own events
DROP POLICY IF EXISTS "insert_own_events" ON user_events;
CREATE POLICY "insert_own_events" ON user_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can update only their own events
DROP POLICY IF EXISTS "update_own_events" ON user_events;
CREATE POLICY "update_own_events" ON user_events
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users can delete only their own events
DROP POLICY IF EXISTS "delete_own_events" ON user_events;
CREATE POLICY "delete_own_events" ON user_events
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Index for the main query pattern: get all events for a user, newest first
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events (user_id, created_at DESC);

-- Index for filtering by type within a user
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events (user_id, type);
