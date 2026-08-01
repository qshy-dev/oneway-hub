/*
# Create user_donation_services table

1. New Tables
- `user_donation_services`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), FK to auth.users with CASCADE delete)
  - `service` (text, not null — 'donation_alerts' | 'donatpay')
  - `connected` (boolean, default false)
  - `connected_at` (timestamp)
  - `created_at` (timestamp)
2. Security
- Enable RLS on `user_donation_services`.
- Owner-scoped CRUD: each authenticated user can only access their own rows.
3. Notes
- Unique constraint on (user_id, service) so each user has one record per service.
- This stores which donation services the user has connected (placeholder for now).
*/

CREATE TABLE IF NOT EXISTS user_donation_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  service text NOT NULL CHECK (service IN ('donation_alerts', 'donatpay')),
  connected boolean NOT NULL DEFAULT false,
  connected_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_donation_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_donation_services" ON user_donation_services;
CREATE POLICY "select_own_donation_services"
ON user_donation_services FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_donation_services" ON user_donation_services;
CREATE POLICY "insert_own_donation_services"
ON user_donation_services FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_donation_services" ON user_donation_services;
CREATE POLICY "update_own_donation_services"
ON user_donation_services FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_donation_services" ON user_donation_services;
CREATE POLICY "delete_own_donation_services"
ON user_donation_services FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_donation_services_user_service
ON user_donation_services (user_id, service);
