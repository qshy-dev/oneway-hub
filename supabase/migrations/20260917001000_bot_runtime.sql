ALTER TABLE public.bot_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_config FROM anon, authenticated;
GRANT ALL ON public.bot_config TO service_role;
ALTER TABLE public.bot_channels ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'disconnected';
ALTER TABLE public.bot_channels ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;
ALTER TABLE public.bot_channels ADD COLUMN IF NOT EXISTS last_error text;
-- Connection status is written only by the runtime, never by a browser.
REVOKE INSERT, UPDATE, DELETE ON public.bot_channels FROM anon, authenticated;

CREATE TABLE public.bot_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  return_to text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);
ALTER TABLE public.bot_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_oauth_states FROM anon, authenticated;

CREATE TABLE public.bot_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name ~ '^[a-z0-9_]{1,32}$'),
  response text NOT NULL CHECK (length(response) BETWEEN 1 AND 450),
  enabled boolean NOT NULL DEFAULT true,
  cooldown integer NOT NULL DEFAULT 10 CHECK (cooldown BETWEEN 5 AND 3600),
  UNIQUE(owner_id, name)
);
ALTER TABLE public.bot_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_commands ON public.bot_commands FOR ALL TO authenticated USING(owner_id = auth.uid()) WITH CHECK(owner_id = auth.uid());

CREATE TABLE public.bot_messages (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_name text NOT NULL,
  username text NOT NULL,
  message text NOT NULL,
  kind text NOT NULL DEFAULT 'chat',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_bot_messages ON public.bot_messages FOR SELECT TO authenticated USING(owner_id = auth.uid());
CREATE INDEX bot_messages_recent ON public.bot_messages(owner_id, created_at DESC);

CREATE TABLE public.bot_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_name text NOT NULL,
  message text NOT NULL CHECK(length(message) BETWEEN 1 AND 450),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_outbox ON public.bot_outbox FOR SELECT TO authenticated USING(owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_bot_message(p_id text, p_owner uuid, p_channel text, p_chatter text, p_username text, p_message text, p_kind text DEFAULT 'chat')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted integer;
BEGIN
  INSERT INTO bot_messages(id,owner_id,channel_name,username,message,kind) VALUES(p_id,p_owner,p_channel,p_username,p_message,p_kind) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted > 0 AND p_kind = 'chat' THEN
    INSERT INTO channel_chat_activity(user_id,chatter_id,activity_date,messages) VALUES(p_owner,p_chatter,(now() AT TIME ZONE 'UTC')::date,1)
    ON CONFLICT(user_id,chatter_id,activity_date) DO UPDATE SET messages = channel_chat_activity.messages + 1;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_bot_message(text,uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_bot_message(text,uuid,text,text,text,text,text) TO service_role;
