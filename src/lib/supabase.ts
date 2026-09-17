import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Profile = {
  id: string;
  twitch_id: string | null;
  twitch_username: string | null;
  twitch_display_name: string | null;
  twitch_avatar: string | null;
  twitch_broadcaster_type: string | null;
  created_at: string;
  updated_at: string;
  // Extended Twitch data
  twitch_description: string | null;
  twitch_created_at: string | null;
  twitch_offline_image_url: string | null;
  twitch_view_count: number | null;
  twitch_channel_language: string | null;
  twitch_game_id: string | null;
  twitch_game_name: string | null;
  twitch_stream_title: string | null;
  twitch_stream_delay: number | null;
  twitch_stream_tags: string[] | null;
  twitch_is_live: boolean | null;
  twitch_stream_started_at: string | null;
  twitch_stream_viewer_count: number | null;
  twitch_stream_type: string | null;
  twitch_follower_count: number | null;
  twitch_following_count: number | null;
  twitch_video_count: number | null;
  twitch_total_video_views: number | null;
  twitch_latest_video_id: string | null;
  twitch_latest_video_title: string | null;
  twitch_latest_video_url: string | null;
  twitch_latest_video_created_at: string | null;
  twitch_latest_video_view_count: number | null;
  twitch_latest_video_duration: string | null;
  twitch_team_names: string[] | null;
  twitch_emote_count: number | null;
  twitch_data_updated_at: string | null;
  twitch_eventsub_enabled: boolean | null;
  twitch_last_stream_id: string | null;
  twitch_last_stream_started_at: string | null;
  twitch_last_stream_title: string | null;
  twitch_last_stream_game_name: string | null;
  twitch_last_stream_duration_sec: number | null;
  twitch_last_stream_peak_viewers: number | null;
  twitch_last_stream_avg_viewers: number | null;
  twitch_last_stream_url: string | null;
};
