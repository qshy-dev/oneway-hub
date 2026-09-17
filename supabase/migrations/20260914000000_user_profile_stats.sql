/*
# User Profile Statistics — Emoji Stats + RPC Aggregations

## Purpose
Stores aggregated emoji usage per chatter per streamer, and provides
RPC functions for user-facing profile statistics (games + chat).

## Design
- No raw message text is stored — only counters.
- Emoji stats are aggregated per (streamer, chatter, emoji) triple.
- RPC functions aggregate across all streamers for a given chatter.
*/

-- Aggregated emoji usage per chatter per streamer
CREATE TABLE IF NOT EXISTS chat_emoji_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_twitch_id text NOT NULL,
  chatter_twitch_id text NOT NULL,
  emoji text NOT NULL,
  is_7tv boolean NOT NULL DEFAULT false,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (streamer_twitch_id, chatter_twitch_id, emoji)
);

ALTER TABLE chat_emoji_stats ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_emoji_stats_streamer ON chat_emoji_stats (streamer_twitch_id, chatter_twitch_id);
CREATE INDEX IF NOT EXISTS idx_emoji_stats_chatter ON chat_emoji_stats (chatter_twitch_id);

-- RPC: get aggregated game stats for a chatter across all streamers
CREATE OR REPLACE FUNCTION public.get_user_game_stats(p_chatter_twitch_id text)
RETURNS TABLE (
  total_games bigint,
  wins bigint,
  total_score bigint,
  best_score integer,
  avg_score numeric,
  best_duration_ms integer,
  games_by_game jsonb
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS total_games,
    COUNT(*) FILTER (WHERE hit = true)::bigint AS wins,
    COALESCE(SUM(score), 0)::bigint AS total_score,
    COALESCE(MAX(score), 0)::integer AS best_score,
    COALESCE(AVG(score), 0)::numeric(10,1) AS avg_score,
    COALESCE(MIN(duration_ms) FILTER (WHERE hit = true), 0)::integer AS best_duration_ms,
    COALESCE(
      jsonb_object_agg(game_id, cnt),
      '{}'::jsonb
    ) AS games_by_game
  FROM (
    SELECT game_id, score, hit, duration_ms,
           COUNT(*) OVER (PARTITION BY game_id) AS cnt
    FROM game_results
    WHERE chatter_twitch_id = p_chatter_twitch_id
  ) sub
$$;

GRANT EXECUTE ON FUNCTION public.get_user_game_stats(text) TO authenticated, anon;

-- RPC: get chat overview for a chatter across all streamers
CREATE OR REPLACE FUNCTION public.get_user_chat_overview(p_chatter_twitch_id text)
RETURNS TABLE (
  total_messages bigint,
  streamers_count bigint,
  top_streamer_twitch_id text,
  top_streamer_username text,
  top_streamer_messages integer,
  last_seen_at timestamptz,
  streamers jsonb
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH chatter_stats AS (
    SELECT
      cms.streamer_twitch_id,
      cms.streamer_twitch_username,
      cms.message_count,
      cms.last_seen_at
    FROM chat_message_stats cms
    WHERE cms.chatter_twitch_id = p_chatter_twitch_id
  ),
  ranked AS (
    SELECT
      streamer_twitch_id,
      streamer_twitch_username,
      message_count,
      last_seen_at,
      ROW_NUMBER() OVER (ORDER BY message_count DESC) AS rn
    FROM chatter_stats
  )
  SELECT
    COALESCE(SUM(cs.message_count), 0)::bigint AS total_messages,
    COUNT(DISTINCT cs.streamer_twitch_id)::bigint AS streamers_count,
    r.streamer_twitch_id AS top_streamer_twitch_id,
    r.streamer_twitch_username AS top_streamer_username,
    r.message_count::integer AS top_streamer_messages,
    MAX(cs.last_seen_at) AS last_seen_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'twitch_id', cs.streamer_twitch_id,
          'username', cs.streamer_twitch_username,
          'messages', cs.message_count,
          'last_seen', cs.last_seen_at
        ) ORDER BY cs.message_count DESC
      ) FILTER (WHERE cs.streamer_twitch_id IS NOT NULL),
      '[]'::jsonb
    ) AS streamers
  FROM chatter_stats cs
  LEFT JOIN ranked r ON r.rn = 1
  GROUP BY r.streamer_twitch_id, r.streamer_twitch_username, r.message_count
$$;

GRANT EXECUTE ON FUNCTION public.get_user_chat_overview(text) TO authenticated, anon;

-- RPC: get emoji stats for a chatter across all streamers
CREATE OR REPLACE FUNCTION public.get_user_emoji_stats(p_chatter_twitch_id text)
RETURNS TABLE (
  total_emoji_uses bigint,
  unique_emojis bigint,
  top_emoji text,
  top_emoji_count bigint,
  top_7tv_emote text,
  top_7tv_count bigint,
  emojis jsonb
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH aggregated AS (
    SELECT
      emoji,
      is_7tv,
      SUM(count) AS total_count
    FROM chat_emoji_stats
    WHERE chatter_twitch_id = p_chatter_twitch_id
    GROUP BY emoji, is_7tv
  ),
  ranked AS (
    SELECT emoji, is_7tv, total_count,
           ROW_NUMBER() OVER (PARTITION BY is_7tv ORDER BY total_count DESC) AS rn
    FROM aggregated
  )
  SELECT
    COALESCE(SUM(a.total_count), 0)::bigint AS total_emoji_uses,
    COUNT(DISTINCT a.emoji)::bigint AS unique_emojis,
    (SELECT r.emoji FROM ranked r WHERE r.is_7tv = false AND r.rn = 1) AS top_emoji,
    (SELECT r.total_count FROM ranked r WHERE r.is_7tv = false AND r.rn = 1) AS top_emoji_count,
    (SELECT r.emoji FROM ranked r WHERE r.is_7tv = true AND r.rn = 1) AS top_7tv_emote,
    (SELECT r.total_count FROM ranked r WHERE r.is_7tv = true AND r.rn = 1) AS top_7tv_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object('emoji', a.emoji, 'count', a.total_count, 'is_7tv', a.is_7tv)
        ORDER BY a.total_count DESC
      ) FILTER (WHERE a.emoji IS NOT NULL),
      '[]'::jsonb
    ) AS emojis
  FROM aggregated a
$$;

GRANT EXECUTE ON FUNCTION public.get_user_emoji_stats(text) TO authenticated, anon;

-- RPC: increment emoji count (atomic upsert with addition)
CREATE OR REPLACE FUNCTION public.increment_emoji_count(
  p_streamer_twitch_id text,
  p_chatter_twitch_id text,
  p_emoji text,
  p_is_7tv boolean,
  p_count integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO chat_emoji_stats (streamer_twitch_id, chatter_twitch_id, emoji, is_7tv, count, updated_at)
  VALUES (p_streamer_twitch_id, p_chatter_twitch_id, p_emoji, p_is_7tv, p_count, now())
  ON CONFLICT (streamer_twitch_id, chatter_twitch_id, emoji)
  DO UPDATE SET
    count = chat_emoji_stats.count + EXCLUDED.count,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_emoji_count(text, text, text, boolean, integer) TO anon, authenticated, service_role;
