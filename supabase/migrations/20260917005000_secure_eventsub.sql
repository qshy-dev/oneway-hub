CREATE TABLE IF NOT EXISTS public.twitch_eventsub_messages (
  message_id text PRIMARY KEY,
  message_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.twitch_eventsub_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.twitch_eventsub_messages FROM anon, authenticated;
GRANT ALL ON public.twitch_eventsub_messages TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS twitch_eventsub_user_type_unique
  ON public.twitch_eventsub_subscriptions(user_id, subscription_type);
CREATE UNIQUE INDEX IF NOT EXISTS twitch_stream_sessions_stream_unique
  ON public.twitch_stream_sessions(twitch_stream_id);

CREATE OR REPLACE FUNCTION public.record_twitch_eventsub_message(p_message_id text, p_message_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE inserted integer;
BEGIN
  INSERT INTO twitch_eventsub_messages(message_id, message_type)
  VALUES(p_message_id, p_message_type)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.record_twitch_eventsub_message(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_twitch_eventsub_message(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.insert_auction_bid(text, text, text, text, integer, text, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_auction_bid(text, text, text, text, integer, text, boolean, text) TO service_role;
REVOKE ALL ON FUNCTION public.increment_emoji_count(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_emoji_count(uuid, text, text, integer) TO service_role;
