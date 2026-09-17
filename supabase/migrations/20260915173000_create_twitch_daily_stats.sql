CREATE TABLE IF NOT EXISTS twitch_stream_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stat_date date NOT NULL,
  hours_streamed numeric NOT NULL DEFAULT 0,
  streams_count integer NOT NULL DEFAULT 0,
  peak_viewers integer NOT NULL DEFAULT 0,
  avg_viewers numeric NOT NULL DEFAULT 0,
  total_viewers numeric NOT NULL DEFAULT 0,
  unique_chatters integer NOT NULL DEFAULT 0,
  total_messages integer NOT NULL DEFAULT 0,
  total_emojis integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, stat_date)
);
ALTER TABLE twitch_stream_daily_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_daily_stats" ON twitch_stream_daily_stats;
CREATE POLICY "select_own_daily_stats" ON twitch_stream_daily_stats FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_daily_stats" ON twitch_stream_daily_stats;
CREATE POLICY "insert_own_daily_stats" ON twitch_stream_daily_stats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_daily_stats" ON twitch_stream_daily_stats;
CREATE POLICY "update_own_daily_stats" ON twitch_stream_daily_stats FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user ON twitch_stream_daily_stats (user_id, stat_date DESC);

CREATE TABLE IF NOT EXISTS twitch_chat_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stat_date date NOT NULL,
  total_messages integer NOT NULL DEFAULT 0,
  unique_chatters integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, stat_date)
);
ALTER TABLE twitch_chat_daily_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_chat_daily" ON twitch_chat_daily_stats;
CREATE POLICY "select_own_chat_daily" ON twitch_chat_daily_stats FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_chat_daily" ON twitch_chat_daily_stats;
CREATE POLICY "insert_own_chat_daily" ON twitch_chat_daily_stats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_chat_daily" ON twitch_chat_daily_stats;
CREATE POLICY "update_own_chat_daily" ON twitch_chat_daily_stats FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_chat_daily_user ON twitch_chat_daily_stats (user_id, stat_date DESC);