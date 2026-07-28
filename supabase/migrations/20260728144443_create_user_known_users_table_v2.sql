/*
# Create user_known_users table for unique participants and winners

## Purpose
Stores one row per unique Twitch username per streamer (authenticated user).
Combines unique participant tracking and win counts in one table to avoid
duplicating usernames. A participant who later wins has their win_count
incremented on the existing row.

## New Tables
- `user_known_users`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid()) — owner (streamer), FK to auth.users CASCADE
  - `username` (text, not null) — Twitch username (lowercase)
  - `first_seen_at` (timestamptz, default now())
  - `win_count` (integer, not null, default 0)
  - Unique constraint on (user_id, username)

## Indexes
- `idx_user_known_users_user_id` on (user_id)
- `idx_user_known_users_win_count` on (user_id, win_count DESC)

## Security
- RLS enabled. Owner-scoped CRUD via auth.uid() = user_id.
- user_id defaults to auth.uid().

## Storage Estimate
- Each row ~120 bytes. 1M streamers × 100 participants = ~12 GB worst case.
- Realistic (10-50 participants per streamer): 1-5 GB.
*/

CREATE TABLE IF NOT EXISTS user_known_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  win_count integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, username)
);

ALTER TABLE user_known_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_known_users" ON user_known_users;
CREATE POLICY "select_own_known_users" ON user_known_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_known_users" ON user_known_users;
CREATE POLICY "insert_own_known_users" ON user_known_users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_known_users" ON user_known_users;
CREATE POLICY "update_own_known_users" ON user_known_users
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_known_users" ON user_known_users;
CREATE POLICY "delete_own_known_users" ON user_known_users
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_known_users_user_id ON user_known_users (user_id);
CREATE INDEX IF NOT EXISTS idx_user_known_users_win_count ON user_known_users (user_id, win_count DESC);
