/*
# Allow authenticated users to read any profile

1. Security
- Adds a SELECT policy on `profiles` allowing all authenticated users to read any profile row.
- Profile data contains only public Twitch information (username, display name, avatar, broadcaster type, timestamps), so broad read access is safe.
- The existing `select_own_profile` policy is kept; the new policy is additive.
*/

DROP POLICY IF EXISTS "select_all_profiles" ON profiles;
CREATE POLICY "select_all_profiles" ON profiles
  FOR SELECT TO authenticated USING (true);
