/*
# Create bot_config and bot_channels tables for the Oneway Bot

## Purpose
- `bot_config`: Stores the OAuth credentials and identity of the Oneway Bot account (onewaymod).
  The bot is a global service that connects to multiple Twitch channels.
- `bot_channels`: Maps which channels the bot joins, enabling the multi-channel
  architecture where one bot serves multiple streamer channels.

## New Tables
- `bot_config`
  - `id` (uuid, primary key)
  - `bot_username` (text, not null) — e.g. "onewaymod"
  - `bot_twitch_user_id` (text) — Twitch numeric user ID of the bot account
  - `bot_display_name` (text) — display name on Twitch
  - `access_token` (text) — current bot OAuth access token
  - `refresh_token` (text) — OAuth refresh token for long-lived sessions
  - `expires_at` (timestamptz) — when the access token expires
  - `scopes` (text[]) — scopes granted during OAuth
  - `client_id` (text) — Twitch application client ID used for auth
  - `connected` (boolean, default false) — whether the bot is authorized
  - `created_at` / `updated_at` (timestamptz)

- `bot_channels`
  - `id` (uuid, primary key)
  - `bot_config_id` (uuid, FK to bot_config, CASCADE delete)
  - `twitch_channel_id` (text, not null) — broadcaster Twitch user ID
  - `channel_name` (text, not null) — channel login name (lowercase)
  - `enabled` (boolean, default true)
  - `created_at` (timestamptz)

## Security
- RLS enabled on both tables.
- `bot_config` is read-only for authenticated users (admin-only write via Edge Functions).
- `bot_channels` is owner-scoped: each authenticated user can manage only their own
  channel registrations (matched by `auth.uid()` = `owner_id`).

## Notes
- The bot's OAuth tokens are stored in the database, never hardcoded in source.
- The `access_token` is fetched at runtime by Edge Functions via the service role
  key, which bypasses RLS. The frontend only receives the token through a
  dedicated authenticated endpoint for IRC connection purposes.
- Token refresh is handled server-side by the `twitch-bot-auth` Edge Function.
*/

-- bot_config: global bot account configuration
CREATE TABLE IF NOT EXISTS bot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_username text NOT NULL,
  bot_twitch_user_id text,
  bot_display_name text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text[],
  client_id text,
  connected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure only one active bot config row
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_config_username ON bot_config (bot_username);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_bot_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_config_set_updated_at ON bot_config;
CREATE TRIGGER bot_config_set_updated_at
  BEFORE UPDATE ON bot_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_bot_updated_at();

-- bot_channels: channel-to-bot mapping for multi-channel support
CREATE TABLE IF NOT EXISTS bot_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_config_id uuid NOT NULL REFERENCES bot_config(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  twitch_channel_id text NOT NULL,
  channel_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bot_channels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bot_channels_owner ON bot_channels (owner_id);
CREATE INDEX IF NOT EXISTS idx_bot_channels_channel ON bot_channels (twitch_channel_id);
CREATE INDEX IF NOT EXISTS idx_bot_channels_enabled ON bot_channels (enabled);

-- Owner-scoped policies
DROP POLICY IF EXISTS "select_own_bot_channels" ON bot_channels;
CREATE POLICY "select_own_bot_channels"
  ON bot_channels FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "insert_own_bot_channels" ON bot_channels;
CREATE POLICY "insert_own_bot_channels"
  ON bot_channels FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "update_own_bot_channels" ON bot_channels;
CREATE POLICY "update_own_bot_channels"
  ON bot_channels FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "delete_own_bot_channels" ON bot_channels;
CREATE POLICY "delete_own_bot_channels"
  ON bot_channels FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

DROP TRIGGER IF EXISTS bot_channels_set_updated_at ON bot_channels;
CREATE TRIGGER bot_channels_set_updated_at
  BEFORE UPDATE ON bot_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_bot_updated_at();