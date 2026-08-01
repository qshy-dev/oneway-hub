/*
# Allow channel_points as a donation service

1. Modified Tables
- `user_donation_services`
  - Drop and recreate the CHECK constraint on `service` to include 'channel_points'.
2. Notes
- The 'channel_points' service stores whether the user has enabled Twitch channel-point bids.
*/

ALTER TABLE user_donation_services DROP CONSTRAINT IF EXISTS user_donation_services_service_check;

ALTER TABLE user_donation_services ADD CONSTRAINT user_donation_services_service_check
CHECK (service IN ('donation_alerts', 'donatpay', 'channel_points'));
