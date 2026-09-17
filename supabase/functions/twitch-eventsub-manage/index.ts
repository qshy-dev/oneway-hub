import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TWITCH_CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID") ?? "";
// EventSub subscription types that cost 0 when the broadcaster has authorized the app
// (i.e. we hold a user access token with the matching scope).
const SUBSCRIPTION_TYPES: { type: string; version: string; condition: Record<string, string> }[] = [
  { type: "stream.online", version: "1", condition: {} },
  { type: "stream.offline", version: "1", condition: {} },
  { type: "channel.update", version: "2", condition: {} },
  { type: "channel.follow", version: "2", condition: {} },
  { type: "channel.subscribe", version: "1", condition: {} },
];

async function subscribeAll(
  supabase: ReturnType<typeof createClient>,
  broadcasterId: string,
  accessToken: string,
  clientId: string,
  userId: string
) {
  const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twitch-eventsub-webhook`;
  const secret = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").slice(0, 32);

  const results: { type: string; subscription_id?: string; error?: string }[] = [];

  for (const sub of SUBSCRIPTION_TYPES) {
    try {
      const subRes = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Client-Id": clientId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: sub.type,
          version: sub.version,
          condition: { broadcaster_user_id: broadcasterId, ...sub.condition },
          transport: {
            method: "webhook",
            callback: callbackUrl,
            secret,
          },
        }),
      });

      if (!subRes.ok) {
        const errText = await subRes.text();
        results.push({ type: sub.type, error: `Twitch API error: ${errText.slice(0, 200)}` });
        continue;
      }

      const subData = await subRes.json();
      const subscriptionId = subData?.data?.[0]?.id;
      if (subscriptionId) {
        await supabase.from("twitch_eventsub_subscriptions").upsert(
          {
            user_id: userId,
            subscription_id: subscriptionId,
            subscription_type: sub.type,
            status: "enabled",
          },
          { onConflict: "user_id, subscription_type" }
        );
        results.push({ type: sub.type, subscription_id: subscriptionId });
      } else {
        results.push({ type: sub.type, error: "no subscription id returned" });
      }
    } catch (err) {
      results.push({ type: sub.type, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}

async function unsubscribeAll(
  supabase: ReturnType<typeof createClient>,
  accessToken: string,
  clientId: string,
  userId: string
) {
  const { data: subs } = await supabase
    .from("twitch_eventsub_subscriptions")
    .select("id, subscription_id")
    .eq("user_id", userId)
    .in("status", ["enabled", "pending"]);

  if (subs && subs.length > 0) {
    for (const sub of subs) {
      try {
        await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${sub.subscription_id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Client-Id": clientId,
          },
        });
      } catch { /* ignore */ }
    }
    await supabase
      .from("twitch_eventsub_subscriptions")
      .update({ status: "disabled" })
      .eq("user_id", userId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("twitch_id, twitch_access_token")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.twitch_id || !profile?.twitch_access_token) {
      return new Response(JSON.stringify({ error: "Twitch not connected or no access token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "subscribe";

    if (action === "unsubscribe") {
      await unsubscribeAll(supabase, profile.twitch_access_token, TWITCH_CLIENT_ID, user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await subscribeAll(
      supabase,
      profile.twitch_id,
      profile.twitch_access_token,
      TWITCH_CLIENT_ID,
      user.id
    );

    const errors = results.filter((r) => r.error);
    return new Response(
      JSON.stringify({
        success: true,
        subscriptions: results,
        error_count: errors.length,
        errors: errors.length ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});