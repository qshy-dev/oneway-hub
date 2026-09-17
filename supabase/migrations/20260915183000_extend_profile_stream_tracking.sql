ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_eventsub_enabled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_last_stream_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_last_stream_started_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_last_stream_title text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_last_stream_game_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_last_stream_duration_sec integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_last_stream_peak_viewers integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_last_stream_avg_viewers numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_last_stream_url text;