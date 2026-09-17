CREATE OR REPLACE FUNCTION public.get_twitch_channel_stats_30d(p_user_id uuid)
RETURNS TABLE (
  followers integer,
  avg_viewers_30d numeric,
  peak_viewers_30d integer,
  hours_streamed_30d numeric,
  streams_30d integer,
  chatters_30d integer,
  messages_30d integer,
  total_viewers_30d numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(p.twitch_follower_count, 0)::integer AS followers,
    COALESCE(AVG(d.avg_viewers) FILTER (WHERE d.stat_date >= CURRENT_DATE - INTERVAL '29 days'), 0)::numeric(10,1) AS avg_viewers_30d,
    COALESCE(MAX(d.peak_viewers) FILTER (WHERE d.stat_date >= CURRENT_DATE - INTERVAL '29 days'), 0)::integer AS peak_viewers_30d,
    COALESCE(SUM(d.hours_streamed) FILTER (WHERE d.stat_date >= CURRENT_DATE - INTERVAL '29 days'), 0)::numeric(10,2) AS hours_streamed_30d,
    COALESCE(SUM(d.streams_count) FILTER (WHERE d.stat_date >= CURRENT_DATE - INTERVAL '29 days'), 0)::integer AS streams_30d,
    COALESCE(SUM(d.unique_chatters) FILTER (WHERE d.stat_date >= CURRENT_DATE - INTERVAL '29 days'), 0)::integer AS chatters_30d,
    COALESCE(SUM(c.total_messages) FILTER (WHERE c.stat_date >= CURRENT_DATE - INTERVAL '29 days'), 0)::integer AS messages_30d,
    COALESCE(SUM(d.total_viewers) FILTER (WHERE d.stat_date >= CURRENT_DATE - INTERVAL '29 days'), 0)::numeric(10,0) AS total_viewers_30d
  FROM profiles p
  LEFT JOIN twitch_stream_daily_stats d ON d.user_id = p_user_id
  LEFT JOIN twitch_chat_daily_stats c ON c.user_id = p_user_id
  WHERE p.id = p_user_id
  GROUP BY p.id, p.twitch_follower_count
$$;

GRANT EXECUTE ON FUNCTION public.get_twitch_channel_stats_30d(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.upsert_twitch_stream_daily_stats(
  p_user_id uuid,
  p_stat_date date,
  p_hours_streamed numeric,
  p_streams_count integer,
  p_peak_viewers integer,
  p_avg_viewers numeric,
  p_total_viewers numeric,
  p_unique_chatters integer,
  p_total_messages integer,
  p_total_emojis integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO twitch_stream_daily_stats (
    user_id, stat_date, hours_streamed, streams_count, peak_viewers,
    avg_viewers, total_viewers, unique_chatters, total_messages, total_emojis
  )
  VALUES (
    p_user_id, p_stat_date, p_hours_streamed, p_streams_count, p_peak_viewers,
    p_avg_viewers, p_total_viewers, p_unique_chatters, p_total_messages, p_total_emojis
  )
  ON CONFLICT (user_id, stat_date)
  DO UPDATE SET
    hours_streamed = twitch_stream_daily_stats.hours_streamed + EXCLUDED.hours_streamed,
    streams_count = twitch_stream_daily_stats.streams_count + EXCLUDED.streams_count,
    peak_viewers = GREATEST(twitch_stream_daily_stats.peak_viewers, EXCLUDED.peak_viewers),
    avg_viewers = (twitch_stream_daily_stats.avg_viewers * twitch_stream_daily_stats.streams_count + EXCLUDED.avg_viewers * EXCLUDED.streams_count)
      / NULLIF(twitch_stream_daily_stats.streams_count + EXCLUDED.streams_count, 0),
    total_viewers = twitch_stream_daily_stats.total_viewers + EXCLUDED.total_viewers,
    unique_chatters = GREATEST(twitch_stream_daily_stats.unique_chatters, EXCLUDED.unique_chatters),
    total_messages = twitch_stream_daily_stats.total_messages + EXCLUDED.total_messages,
    total_emojis = twitch_stream_daily_stats.total_emojis + EXCLUDED.total_emojis,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_twitch_stream_daily_stats(uuid, date, numeric, integer, integer, numeric, numeric, integer, integer, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_twitch_chat_daily_stats(
  p_user_id uuid,
  p_stat_date date,
  p_total_messages integer,
  p_unique_chatters integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO twitch_chat_daily_stats (user_id, stat_date, total_messages, unique_chatters)
  VALUES (p_user_id, p_stat_date, p_total_messages, p_unique_chatters)
  ON CONFLICT (user_id, stat_date)
  DO UPDATE SET
    total_messages = twitch_chat_daily_stats.total_messages + EXCLUDED.total_messages,
    unique_chatters = GREATEST(twitch_chat_daily_stats.unique_chatters, EXCLUDED.unique_chatters),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_twitch_chat_daily_stats(uuid, date, integer, integer) TO anon, authenticated, service_role;