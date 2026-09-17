-- Public profiles receive aggregate channel data, never chatter IDs, messages,
-- OAuth credentials or subscriber counts.
CREATE OR REPLACE FUNCTION public.get_public_channel_analytics(p_user_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
SELECT jsonb_build_object(
  'snapshot', (SELECT snapshot - 'subscribers' FROM channel_analytics WHERE user_id = p_user_id),
  'summary', (SELECT to_jsonb(s) FROM get_twitch_channel_stats_30d(p_user_id) s),
  'sessions', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM (
    SELECT id,title,game_name,started_at,ended_at,peak_viewers,avg_viewers,viewer_samples,last_observed_at
    FROM twitch_stream_sessions WHERE user_id = p_user_id AND started_at >= now() - interval '30 days'
    ORDER BY started_at DESC LIMIT 100
  ) s), '[]'::jsonb)
) WHERE EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id);
$$;
REVOKE ALL ON FUNCTION public.get_public_channel_analytics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_channel_analytics(uuid) TO anon, authenticated;
