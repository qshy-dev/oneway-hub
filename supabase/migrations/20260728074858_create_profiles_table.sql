/*
# Create profiles table for Twitch-authenticated users

## Purpose
Stores per-user profile information linked to Supabase Auth.
When a user signs in via Twitch OAuth, Supabase creates a row in
`auth.users` automatically. This table extends that with Twitch-specific
public profile data (display name, avatar, Twitch numeric ID).

## New Tables
- `profiles`
  - `id` (uuid, primary key) — matches the user's id in `auth.users`
  - `twitch_id` (text, unique, nullable) — Twitch's numeric user ID
  - `twitch_username` (text, nullable) — Twitch login name (lowercase)
  - `twitch_display_name` (text, nullable) — Twitch display name (original casing)
  - `twitch_avatar` (text, nullable) — URL to the user's Twitch profile picture
  - `twitch_broadcaster_type` (text, nullable) — "partner", "affiliate", or "" (regular)
  - `created_at` (timestamptz) — when the profile row was created
  - `updated_at` (timestamptz) — last time the profile was updated

## Security
- RLS enabled on `profiles`.
- Each authenticated user can read their own profile row.
- Each authenticated user can update their own profile row.
- INSERT is handled server-side (see Notes), not by the client.
- No anonymous access — sign-in is required.

## Notes
1. The `id` column is a foreign key to `auth.users(id)` with CASCADE delete,
   so if a user is deleted from Supabase Auth, their profile row is removed too.
2. Profile rows are created by a trigger when a new auth user is inserted,
   or by an edge function during the Twitch OAuth callback. The client does
   not insert directly — the INSERT policy is scoped to authenticated users
   who can only insert a row with their own `id`, as a safety net.
3. `updated_at` auto-updates via a trigger on every UPDATE.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  twitch_id text UNIQUE,
  twitch_username text,
  twitch_display_name text,
  twitch_avatar text,
  twitch_broadcaster_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow each user to read their own profile
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Allow each user to update their own profile
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow a user to insert their own profile row (safety net; normally trigger-created)
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Auto-create a profile row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
