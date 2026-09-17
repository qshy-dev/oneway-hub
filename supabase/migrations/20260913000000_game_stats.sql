/*
# Game results and chat message statistics

## Purpose
Stores server-side statistics for Twitch mini-games and chat messages,
tied to Twitch streamer (site owner) and chatter accounts.

## New Tables
- `game_results`
  - `id` (uuid, primary key)
  - `streamer_user_id` (uuid, nullable — Supabase auth user of the streamer)
  - `streamer_twitch_id` (text, not null — broadcaster Twitch ID)
  - `streamer_twitch_username` (text, not null)
  - `chatter_twitch_id` (text, not null)
  - `chatter_twitch_username` (text, not null)
  - `chatter_display_name` (text)
  - `chatter_color` (text)
  - `game_id` (text, not null)
  - `score` (integer, default 0)
  - `stars` (integer, default 0)
  - `duration_ms` (integer)
  - `hit` (boolean, default false)
  - `created_at` (timestamptz, default now())
- `chat_message_stats`
  - `id` (uuid, primary key)
  - `streamer_twitch_id` (text, not null)
  - `streamer_twitch_username` (text)
  - `chatter_twitch_id` (text, not null)
  - `chatter_twitch_username` (text, not null)
  - `chatter_display_name` (text)
  - `message_count` (integer, not null default 0)
  - `last_seen_at` (timestamptz)
  - `top_7tv_emotes` (jsonb, default '{}')
  - `updated_at` (timestamptz, default now())
  - UNIQUE (streamer_twitch_id, chatter_twitch_id)
- `game_sessions`
  - `id` (uuid, primary key)
  - `streamer_user_id` (uuid, not null)
  - `streamer_twitch_id` (text, not null)
  - `game_id` (text, not null)
  - `token` (text, unique, not null)
  - `expires_at` (timestamptz, not null)
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled on all three tables.
- `game_results` and `chat_message_stats` are owner-scoped by streamer_user_id
  where present; rows without a Supabase user (anonymous browser source) are
  readable by the streamer via streamer_twitch_id lookup RPC.
- `game_sessions` owner-scoped by streamer_user_id.
- Inserts from browser source happen through SECURITY DEFINER edge functions
  using the service role key, so RLS is bypassed server-side.

## Storage
- Compact: one row per game attempt and one aggregate row per chatter per
  streamer. Chat message text is NOT stored, only aggregates and top emotes.
*/

CREATE TABLE IF NOT EXISTS game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  streamer_twitch_id text NOT NULL,
  streamer_twitch_username text,
  chatter_twitch_id text NOT NULL,
  chatter_twitch_username text,
  chatter_display_name text,
  chatter_color text,
  game_id text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  stars integer NOT NULL DEFAULT 0,
  duration_ms integer,
  hit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_game_results" ON game_results;
CREATE POLICY "select_own_game_results"
  ON game_results FOR SELECT
  TO authenticated
  USING (auth.uid() = streamer_user_id);

CREATE INDEX IF NOT EXISTS idx_game_results_streamer ON game_results (streamer_twitch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_results_chatter ON game_results (chatter_twitch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_results_game ON game_results (game_id, created_at DESC);

-- Aggregate chat message stats per chatter per streamer
CREATE TABLE IF NOT EXISTS chat_message_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_twitch_id text NOT NULL,
  streamer_twitch_username text,
  chatter_twitch_id text NOT NULL,
  chatter_twitch_username text,
  chatter_display_name text,
  message_count integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz,
  top_7tv_emotes jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (streamer_twitch_id, chatter_twitch_id)
);

ALTER TABLE chat_message_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat_stats" ON chat_message_stats;
CREATE POLICY "select_own_chat_stats"
  ON chat_message_stats FOR SELECT
  TO authenticated
  USING (streamer_twitch_id = (
    SELECT twitch_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_chat_stats_streamer ON chat_message_stats (streamer_twitch_id, message_count DESC);
CREATE INDEX IF NOT EXISTS idx_chat_stats_chatter ON chat_message_stats (chatter_twitch_id);

-- Short-lived session tokens for browser source pages
CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streamer_twitch_id text NOT NULL,
  game_id text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_game_sessions" ON game_sessions;
CREATE POLICY "select_own_game_sessions"
  ON game_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = streamer_user_id);

-- RPC: look up game results for a streamer by Twitch ID (used by public profile)
CREATE OR REPLACE FUNCTION public.get_game_results(p_streamer_twitch_id text)
RETURNS TABLE (
  id uuid,
  streamer_twitch_id text,
  chatter_twitch_id text,
  chatter_twitch_username text,
  chatter_display_name text,
  chatter_color text,
  game_id text,
  score integer,
  stars integer,
  duration_ms integer,
  hit boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    gr.id,
    gr.streamer_twitch_id,
    gr.chatter_twitch_id,
    gr.chatter_twitch_username,
    gr.chatter_display_name,
    gr.chatter_color,
    gr.game_id,
    gr.score,
    gr.stars,
    gr.duration_ms,
    gr.hit,
    gr.created_at
  FROM game_results gr
  WHERE gr.streamer_twitch_id = p_streamer_twitch_id
  ORDER BY gr.created_at DESC
  LIMIT 5000;
$$;

GRANT EXECUTE ON FUNCTION public.get_game_results(text) TO authenticated, anon;

-- RPC: look up chat message stats for a streamer by Twitch ID
CREATE OR REPLACE FUNCTION public.get_chat_message_stats(p_streamer_twitch_id text)
RETURNS TABLE (
  chatter_twitch_id text,
  chatter_twitch_username text,
  chatter_display_name text,
  message_count integer,
  last_seen_at timestamptz,
  top_7tv_emotes jsonb
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    cms.chatter_twitch_id,
    cms.chatter_twitch_username,
    cms.chatter_display_name,
    cms.message_count,
    cms.last_seen_at,
    cms.top_7tv_emotes
  FROM chat_message_stats cms
  WHERE cms.streamer_twitch_id = p_streamer_twitch_id
  ORDER BY cms.message_count DESC
  LIMIT 5000;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_message_stats(text) TO authenticated, anon;