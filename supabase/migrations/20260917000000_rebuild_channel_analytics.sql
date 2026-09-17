-- A single cached snapshot and minute samples replace cumulative re-imports.
CREATE TABLE IF NOT EXISTS public.channel_analytics (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channel_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_owner_read ON public.channel_analytics FOR SELECT TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.twitch_stream_sessions ADD COLUMN IF NOT EXISTS viewer_samples integer NOT NULL DEFAULT 0;
ALTER TABLE public.twitch_stream_sessions ADD COLUMN IF NOT EXISTS viewer_sum bigint NOT NULL DEFAULT 0;
ALTER TABLE public.twitch_stream_sessions ADD COLUMN IF NOT EXISTS last_observed_at timestamptz;
-- Older values were overwritten each sync; they are not reliable historical samples.
UPDATE public.twitch_stream_sessions SET peak_viewers = NULL, avg_viewers = NULL WHERE viewer_samples = 0;

CREATE TABLE public.twitch_viewer_samples (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id text NOT NULL,
  sampled_at timestamptz NOT NULL,
  viewers integer NOT NULL CHECK (viewers >= 0),
  PRIMARY KEY(user_id, stream_id, sampled_at)
);
ALTER TABLE public.twitch_viewer_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY samples_owner_read ON public.twitch_viewer_samples FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.channel_chat_activity (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chatter_id text NOT NULL,
  activity_date date NOT NULL,
  messages bigint NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, chatter_id, activity_date)
);
ALTER TABLE public.channel_chat_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_activity_owner_read ON public.channel_chat_activity FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_channel_sample(p_user_id uuid, p_stream jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_minute timestamptz := date_trunc('minute', now()); v_inserted integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  IF p_stream IS NULL OR p_stream = 'null'::jsonb THEN
    UPDATE twitch_stream_sessions SET ended_at = COALESCE(last_observed_at, started_at), updated_at = now()
      WHERE user_id = p_user_id AND ended_at IS NULL;
    RETURN;
  END IF;
  UPDATE twitch_stream_sessions SET ended_at = COALESCE(last_observed_at, started_at)
    WHERE user_id = p_user_id AND ended_at IS NULL AND twitch_stream_id <> p_stream->>'id';
  SELECT id INTO v_id FROM twitch_stream_sessions WHERE user_id = p_user_id AND twitch_stream_id = p_stream->>'id' ORDER BY created_at LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO twitch_stream_sessions(user_id, twitch_stream_id, started_at, title, game_id, game_name)
    VALUES(p_user_id, p_stream->>'id', (p_stream->>'started_at')::timestamptz, p_stream->>'title', p_stream->>'game_id', p_stream->>'game_name') RETURNING id INTO v_id;
  END IF;
  INSERT INTO twitch_viewer_samples VALUES(p_user_id, p_stream->>'id', v_minute, (p_stream->>'viewer_count')::integer) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  UPDATE twitch_stream_sessions SET
    title = p_stream->>'title', game_name = p_stream->>'game_name', game_id = p_stream->>'game_id', ended_at = NULL,
    peak_viewers = GREATEST(peak_viewers, (p_stream->>'viewer_count')::integer),
    viewer_sum = viewer_sum + CASE WHEN v_inserted > 0 THEN (p_stream->>'viewer_count')::integer ELSE 0 END,
    viewer_samples = viewer_samples + v_inserted,
    avg_viewers = (viewer_sum + CASE WHEN v_inserted > 0 THEN (p_stream->>'viewer_count')::integer ELSE 0 END)::numeric / NULLIF(viewer_samples + v_inserted, 0),
    last_observed_at = now(), updated_at = now()
    WHERE id = v_id;
END $$;
REVOKE ALL ON FUNCTION public.record_channel_sample(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_channel_sample(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.get_twitch_channel_stats_30d(p_user_id uuid)
RETURNS TABLE(followers integer, avg_viewers_30d numeric, peak_viewers_30d integer, hours_streamed_30d numeric, streams_30d integer, chatters_30d integer, messages_30d integer, total_viewers_30d numeric)
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT p.twitch_follower_count::integer,
    (SELECT round(avg(viewers), 1) FROM twitch_viewer_samples WHERE user_id = p_user_id AND sampled_at >= now() - interval '30 days'),
    (SELECT max(viewers) FROM twitch_viewer_samples WHERE user_id = p_user_id AND sampled_at >= now() - interval '30 days'),
    (SELECT round(sum(GREATEST(0, extract(epoch FROM (COALESCE(ended_at, last_observed_at) - GREATEST(started_at, now() - interval '30 days'))))) / 3600, 2) FROM twitch_stream_sessions WHERE user_id = p_user_id AND COALESCE(ended_at, last_observed_at) >= now() - interval '30 days'),
    (SELECT count(DISTINCT twitch_stream_id)::integer FROM twitch_stream_sessions WHERE user_id = p_user_id AND started_at >= now() - interval '30 days'),
    (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE count(DISTINCT chatter_id)::integer END FROM channel_chat_activity WHERE user_id = p_user_id AND activity_date >= (now() AT TIME ZONE 'UTC')::date - 29),
    (SELECT sum(messages)::integer FROM channel_chat_activity WHERE user_id = p_user_id AND activity_date >= (now() AT TIME ZONE 'UTC')::date - 29),
    NULL::numeric -- Unique viewers cannot be inferred by adding viewer counts.
  FROM profiles p WHERE p.id = p_user_id;
$$;

-- Deprecated accumulating RPCs must not be writable by browsers.
REVOKE EXECUTE ON FUNCTION public.upsert_twitch_stream_daily_stats(uuid,date,numeric,integer,integer,numeric,numeric,integer,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_twitch_chat_daily_stats(uuid,date,integer,integer) FROM PUBLIC, anon, authenticated;
