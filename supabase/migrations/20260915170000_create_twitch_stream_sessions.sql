CREATE TABLE IF NOT EXISTS twitch_stream_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  twitch_stream_id text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  game_id text,
  game_name text,
  title text,
  tags text[],
  type text,
  is_mature boolean DEFAULT false,
  peak_viewers integer,
  avg_viewers numeric,
  total_chatters integer,
  total_messages integer,
  total_emojis integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE twitch_stream_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_stream_sessions" ON twitch_stream_sessions;
CREATE POLICY "select_own_stream_sessions" ON twitch_stream_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_stream_sessions" ON twitch_stream_sessions;
CREATE POLICY "insert_own_stream_sessions" ON twitch_stream_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_stream_sessions" ON twitch_stream_sessions;
CREATE POLICY "update_own_stream_sessions" ON twitch_stream_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_user ON twitch_stream_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_stream_id ON twitch_stream_sessions (twitch_stream_id);