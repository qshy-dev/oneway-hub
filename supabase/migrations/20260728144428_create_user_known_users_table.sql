/*
# Create user_known_users table for unique participants and winners

## Purpose
Stores one row per unique Twitch username per streamer (authenticated user).
This table serves double duty:
1. Tracks unique participants across all giveaways (for the "unique participants" stat)
2. Tracks win counts per user (for the "top winner" stat)

By combining participants and winners in one table, we avoid duplicating
usernames. A participant who later wins a giveaway simply has their
existing row's win_count incremented.

## New Tables
- `user_known_users`
  - `id` (uuid, primary key) — unique row ID
  - `user_id` (uuid, not null, defaults to auth.uid()) — owner (streamer), FK to auth.users CASCADE
  - `username` (text, not null) — Twitch username (lowercase)
  - `first_seen_at` (timestamptz, default now()) — when this user first appeared in any giveaway
  - `win_count` (integer, not null, default 0) — number of giveaways this user has won
  - Unique constraint on (user_id, username) — each username appears once per streamer

## Indexes
- `idx_user_known_users_user_id` on (user_id) — fast per-user queries
- `idx_user_known_users_user_id_win_count` on (user_id, win_count DESC) — fast top-winner query

## Security
- RLS enabled on user_known_users.
- Each authenticated user can only CRUD their own rows (auth.uid() = user_id).
- user_id defaults to auth.uid() so inserts that omit it pass the WITH CHECK policy.

## Storage Estimate
- Each row ~120 bytes (UUID 16B + UUID 16B + username ~20B + timestamp 8B + int 4B + overhead)
- 1 million streamers × 100 unique participants each = 100M rows = ~12 GB
- Most streamers will have far fewer participants (10-50), so realistic: 1-5 GB
- Using ON CONFLICT DO NOTHING for upserts keeps the table from growing for repeat participants
*/
