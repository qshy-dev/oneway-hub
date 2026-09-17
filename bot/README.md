# Persistent Twitch bot

The site controls a persistent Node 24 worker. Browser sessions never receive
the shared bot token. A database lease allows only one worker to join channels.
The worker handles IRC authentication, confirmed JOINs, reconnects, token refresh,
commands, chat collection and minute viewer samples while the dashboard is closed.

1. Apply the migrations with `npx supabase db push` after reviewing its dry run.
2. Deploy `twitch-bot-auth` and `twitch-channel-sync`. Both handlers validate
   authentication themselves; their configuration permits OAuth callbacks and OPTIONS.
3. Set Supabase secrets `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`,
   `TWITCH_BOT_USERNAME` (default `onewaymod`), `SITE_URL` (site origin), and
   `BOT_ADMIN_USER_IDS` (comma-separated Supabase user UUIDs allowed to authorize
   the shared bot). Register the exact OAuth callback in the Twitch app:
   `https://YOUR_PROJECT.supabase.co/functions/v1/twitch-bot-auth`.
4. Copy `.env.bot.example` to `.env.bot` and fill it on the server. Never put
   service-role keys or Twitch secrets in a `VITE_` variable or commit them.
5. Run `docker compose -f compose.bot.yml up -d --build`, or `npm run bot`
   under a supervisor. Keep Docker/the host running for continuous collection.
6. Sign into the website as a configured administrator, open `/bot`, and authorize
   the **bot account**, granting `chat:read` and `chat:edit`. Existing Helix-only
   tokens must be reauthorized; a refresh cannot add missing scopes.
7. The channel owner presses Connect. The status becomes connected only after
   Twitch acknowledges the bot's JOIN. Confirm presence using Twitch chat and !test.

Only the owner can connect their own Twitch channel. Custom commands support
`{user}` and `{channel}`, per-command cooldowns and enable/disable. Built-ins:
`!help`, `!test`, `!uptime` (actual current broadcast duration).
Outgoing messages are queued and globally throttled. A socket write is recorded
as sent to Twitch, not as proof of delivery to every viewer. Twitch rejection
notices appear in the journal. Interrupted sends are marked failed, never blindly retried.

Chat/journal messages are retained for seven days. Aggregates retain unique chatter
IDs by UTC date; the dashboard explains that historical chat/viewer data before
collection is unavailable. Public profile analytics exclude subscriber counts.
The worker polls Twitch once a minute for enabled channels; API outages do not
mark streams offline. Viewer samples are idempotent per channel/stream/minute.

Verification: `npm test`, `npm run typecheck`, `npm run build` and the transactional
SQL checks in `tests/analytics.sql` against a local Supabase database.
