import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TWITCH_CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID") ?? "";

async function getBotConfig(): Promise<{
  access_token: string;
  bot_twitch_user_id: string;
  bot_username: string;
  client_id: string;
} | null> {
  const { data, error } = await supabase
    .from("bot_config")
    .select("access_token, bot_twitch_user_id, bot_username, client_id")
    .eq("connected", true)
    .maybeSingle();

  if (error || !data?.access_token) return null;
  return data as {
    access_token: string;
    bot_twitch_user_id: string;
    bot_username: string;
    client_id: string;
  };
}

async function refreshBotTokenIfNeeded(): Promise<string | null> {
  const { data } = await supabase
    .from("bot_config")
    .select("access_token, refresh_token, expires_at, bot_username")
    .eq("connected", true)
    .maybeSingle();

  if (!data?.access_token) return null;

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    if (!data.refresh_token) {
      console.warn("Bot token expiring but no refresh token available");
      return data.access_token;
    }

    try {
      const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: data.refresh_token,
          client_id: TWITCH_CLIENT_ID,
          client_secret: Deno.env.get("TWITCH_CLIENT_SECRET") ?? "",
        }),
      });

      if (tokenRes.ok) {
        const newTokens = await tokenRes.json();
        const newAccessToken = newTokens.access_token;
        const newRefreshToken = newTokens.refresh_token;
        const newExpiresIn = newTokens.expires_in;
        const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000).toISOString();
        const newScopes = (newTokens.scope as string[] | undefined) ?? data.scopes;

        await supabase
          .from("bot_config")
          .update({
            access_token: newAccessToken,
            refresh_token: newRefreshToken,
            expires_at: newExpiresAt,
            scopes: newScopes,
            updated_at: new Date().toISOString(),
          })
          .eq("bot_username", data.bot_username);

        console.log(`Bot access token refreshed for ${data.bot_username}`);
        return newAccessToken;
      }
    } catch (e) {
      console.error("Token refresh error:", e);
    }
  }

  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "";

  const botConfig = await getBotConfig();
  if (!botConfig) {
    return new Response(
      JSON.stringify({ error: "Bot not configured. Authorize the bot first." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const accessToken = await refreshBotTokenIfNeeded();
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: "Cannot obtain bot access token" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const clientId = botConfig.client_id || TWITCH_CLIENT_ID;

  const helixHeaders = {
    "Client-Id": clientId,
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    // ——— Send a chat message via Helix Chat API ———
    if (action === "send") {
      const body = await req.json();
      const { broadcaster_id, message } = body;

      if (!broadcaster_id || !message) {
        return new Response(
          JSON.stringify({ error: "broadcaster_id and message are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (message.length > 500) {
        return new Response(
          JSON.stringify({ error: "Message too long (max 500 chars)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const res = await fetch("https://api.twitch.tv/helix/chat/messages", {
        method: "POST",
        headers: helixHeaders,
        body: JSON.stringify({
          broadcaster_id,
          sender_id: botConfig.bot_twitch_user_id,
          message,
        }),
      });

      const responseData = await res.json().catch(() => ({}));

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: `Twitch API error: ${JSON.stringify(responseData)}` }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: responseData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ——— Get chatters list via Helix Chat API ———
    if (action === "chatters" || action === "get_chatters") {
      const broadcasterId = url.searchParams.get("broadcaster_id");
      if (!broadcasterId) {
        return new Response(
          JSON.stringify({ error: "broadcaster_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const params = new URLSearchParams({
        broadcaster_id: broadcasterId,
        moderator_id: botConfig.bot_twitch_user_id,
        first: "1000",
      });

      const res = await fetch(
        `https://api.twitch.tv/helix/chat/chatters?${params}`,
        { headers: helixHeaders },
      );

      if (!res.ok) {
        const err = await res.text();
        return new Response(
          JSON.stringify({ error: `Twitch API error: ${err}`, chatters: [] }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" } },
        );
      }

      const data = await res.json();
      const chatters = data?.data?.map((c: Record<string, unknown>) => ({
        user_id: c.user_id,
        user_login: c.user_login,
        display_name: c.display_name,
        roles: c.roles,
        is_bot: c.is_bot,
      }));

      return new Response(
        JSON.stringify({ chatters, total: data?.total ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" } },
      );
    }

    // ——— Get viewer count via Helix Streams API ———
    if (action === "viewers") {
      const channel = url.searchParams.get("channel")?.trim().toLowerCase().replace(/^#/, "");
      if (!channel) {
        return new Response(
          JSON.stringify({ error: "channel is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // First resolve the channel name to broadcaster_id
      const userRes = await fetch(
        `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`,
        { headers: helixHeaders },
      );

      let broadcasterId: string | null = null;
      if (userRes.ok) {
        const userData = await userRes.json();
        broadcasterId = userData?.data?.[0]?.id ?? null;
      }

      if (!broadcasterId) {
        return new Response(
          JSON.stringify({ channel, live: false, viewers: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" } },
        );
      }

      const streamRes = await fetch(
        `https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(broadcasterId)}`,
        { headers: helixHeaders },
      );

      if (!streamRes.ok) {
        return new Response(
          JSON.stringify({ channel, live: false, viewers: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" } },
        );
      }

      const streamData = await streamRes.json();
      const stream = streamData?.data?.[0];
      const live = !!stream && stream.type === "live";
      const viewers = live ? stream.viewer_count : 0;

      return new Response(
        JSON.stringify({ channel, live, viewers }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" } },
      );
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("twitch-bot-chat error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
