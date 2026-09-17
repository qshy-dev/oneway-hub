/*
# Extend profiles table with comprehensive Twitch data

## Purpose
Add columns to store detailed Twitch account information fetched via Helix API:
- Account description and creation date
- Channel configuration (language, game, title)
- Stream status and metrics
- Follower/following counts
- Video statistics
- Offline image and banner
- Team memberships

## New Columns
- `twitch_description` - Channel description from /users
- `twitch_created_at` - Account creation date from /users
- `twitch_offline_image_url` - Offline banner from /users
- `twitch_view_count` - Total channel views from /users
- `twitch_channel_language` - Broadcast language from /channels
- `twitch_game_id` - Current game ID from /channels
- `twitch_game_name` - Current game name from /channels
- `twitch_stream_title` - Stream title from /channels
- `twitch_stream_delay` - Stream delay from /channels
- `twitch_stream_tags` - Stream tags from /channels (jsonb)
- `twitch_is_live` - Current live status from /streams
- `twitch_stream_started_at` - Stream start time from /streams
- `twitch_stream_viewer_count` - Current viewers from /streams
- `twitch_stream_type` - Stream type (live/rerun/vodcast) from /streams
- `twitch_follower_count` - Follower count from /channels/followers (requires moderator:read:followers)
- `twitch_following_count` - Following count from /channels/followed (already have via follows endpoint)
- `twitch_video_count` - Total videos count (aggregated from /videos)
- `twitch_total_video_views` - Sum of all video views
- `twitch_latest_video_id` - Most recent video ID
- `twitch_latest_video_title` - Most recent video title
- `twitch_latest_video_url` - Most recent video URL
- `twitch_latest_video_created_at` - Most recent video creation date
- `twitch_latest_video_view_count` - Most recent video views
- `twitch_latest_video_duration` - Most recent video duration
- `twitch_team_names` - Array of team names (jsonb)
- `twitch_emote_count` - Number of custom channel emotes
- `twitch_data_updated_at` - When Twitch data was last refreshed
*/

-- Add new columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_description text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_created_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_offline_image_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_view_count bigint;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_channel_language text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_game_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_game_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_stream_title text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_stream_delay integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_stream_tags jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_is_live boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_stream_started_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_stream_viewer_count integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_stream_type text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_follower_count bigint;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_following_count bigint;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_video_count bigint;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_total_video_views bigint;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_latest_video_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_latest_video_title text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_latest_video_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_latest_video_created_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_latest_video_view_count bigint;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_latest_video_duration text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_team_names jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_emote_count integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitch_data_updated_at timestamptz;

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_profiles_twitch_follower_count ON profiles (twitch_follower_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_profiles_twitch_is_live ON profiles (twitch_is_live);
CREATE INDEX IF NOT EXISTS idx_profiles_twitch_game_id ON profiles (twitch_game_id);
CREATE INDEX IF NOT EXISTS idx_profiles_twitch_data_updated_at ON profiles (twitch_data_updated_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN profiles.twitch_description IS 'Channel description from Twitch /users endpoint';
COMMENT ON COLUMN profiles.twitch_created_at IS 'Twitch account creation date (not Supabase profile creation)';
COMMENT ON COLUMN profiles.twitch_offline_image_url IS 'Offline banner image URL from Twitch';
COMMENT ON COLUMN profiles.twitch_view_count IS 'Total channel views from Twitch';
COMMENT ON COLUMN profiles.twitch_channel_language IS 'Broadcast language from Twitch /channels endpoint';
COMMENT ON COLUMN profiles.twitch_game_id IS 'Current game/category ID from Twitch /channels endpoint';
COMMENT ON COLUMN profiles.twitch_game_name IS 'Current game/category name from Twitch /channels endpoint';
COMMENT ON COLUMN profiles.twitch_stream_title IS 'Current stream title from Twitch /channels endpoint';
COMMENT ON COLUMN profiles.twitch_stream_delay IS 'Stream delay in seconds from Twitch /channels endpoint';
COMMENT ON COLUMN profiles.twitch_stream_tags IS 'Stream tags array from Twitch /channels endpoint';
COMMENT ON COLUMN profiles.twitch_is_live IS 'Whether the channel is currently live from Twitch /streams endpoint';
COMMENT ON COLUMN profiles.twitch_stream_started_at IS 'When the current stream started from Twitch /streams endpoint';
COMMENT ON COLUMN profiles.twitch_stream_viewer_count IS 'Current viewer count from Twitch /streams endpoint';
COMMENT ON COLUMN profiles.twitch_stream_type IS 'Stream type (live/rerun/vodcast) from Twitch /streams endpoint';
COMMENT ON COLUMN profiles.twitch_follower_count IS 'Follower count from Twitch /channels/followers (requires moderator:read:followers scope)';
COMMENT ON COLUMN profiles.twitch_following_count IS 'Following count from Twitch /channels/followed (user:read:follows scope)';
COMMENT ON COLUMN profiles.twitch_video_count IS 'Total number of videos from Twitch /videos endpoint';
COMMENT ON COLUMN profiles.twitch_total_video_views IS 'Sum of view_count across all videos';
COMMENT ON COLUMN profiles.twitch_latest_video_id IS 'Most recent video ID';
COMMENT ON COLUMN profiles.twitch_latest_video_title IS 'Most recent video title';
COMMENT ON COLUMN profiles.twitch_latest_video_url IS 'Most recent video URL';
COMMENT ON COLUMN profiles.twitch_latest_video_created_at IS 'Most recent video creation date';
COMMENT ON COLUMN profiles.twitch_latest_video_view_count IS 'Most recent video view count';
COMMENT ON COLUMN profiles.twitch_latest_video_duration IS 'Most recent video duration (ISO 8601 format)';
COMMENT ON COLUMN profiles.twitch_team_names IS 'Array of team names the broadcaster belongs to';
COMMENT ON COLUMN profiles.twitch_emote_count IS 'Number of custom channel emotes';
COMMENT ON COLUMN profiles.twitch_data_updated_at IS 'Timestamp when Twitch data was last refreshed';