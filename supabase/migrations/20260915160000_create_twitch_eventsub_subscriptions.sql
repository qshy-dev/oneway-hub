/*
# Create twitch_eventsub_subscriptions table

## Purpose
Tracks EventSub webhook subscriptions created for the broadcaster's channel.
The existing `twitch-eventsub-manage` edge function inserts into this table, but
no migration created it yet, so the inserts fail on a fresh database.

## New Tables
- `twitch_eventsub_subscriptions`
  - `id` (uuid, primary key)
  - `user_id` (uuid, FK to auth.users, CASCADE delete)
  - `subscription_id` (text) — Twitch EventSub subscription id
  - `subscription_type` (text) — e.g. stream.online, channel.follow
  - `status` (text) — enabled | pending | disabled | notification_failures
  - `created_at` (timestamptz)

## Security
- RLS enabled.
- Each authenticated user can manage only their own subscriptions.
*/

CREATE TABLE IF NOT EXISTS twitch_eventsub_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id text NOT NULL,
  subscription_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subscription_type)
);

ALTER TABLE twitch_eventsub_subscriptions ENABLE ROW LEVEL SECURITY;
-- Earlier deployments already have this table, but without updated_at.
ALTER TABLE twitch_eventsub_subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP POLICY IF EXISTS "select_own_eventsub_subs" ON twitch_eventsub_subscriptions;
CREATE POLICY "select_own_eventsub_subs"
  ON twitch_eventsub_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_eventsub_subs" ON twitch_eventsub_subscriptions;
CREATE POLICY "insert_own_eventsub_subs"
  ON twitch_eventsub_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_eventsub_subs" ON twitch_eventsub_subscriptions;
CREATE POLICY "update_own_eventsub_subs"
  ON twitch_eventsub_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_eventsub_subs" ON twitch_eventsub_subscriptions;
CREATE POLICY "delete_own_eventsub_subs"
  ON twitch_eventsub_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_eventsub_subs_user ON twitch_eventsub_subscriptions (user_id, subscription_type);
CREATE INDEX IF NOT EXISTS idx_eventsub_subs_status ON twitch_eventsub_subscriptions (status);

CREATE OR REPLACE FUNCTION public.set_eventsub_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS eventsub_subs_set_updated_at ON twitch_eventsub_subscriptions;
CREATE TRIGGER eventsub_subs_set_updated_at
  BEFORE UPDATE ON twitch_eventsub_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_eventsub_updated_at();
