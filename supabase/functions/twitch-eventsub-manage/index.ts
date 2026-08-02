import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TWITCH_CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID") ?? "";
const EVENTSUB_TYPE = "channel.channel_points_custom_reward_redemption.add";

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

    // Verify the user's JWT to get their user_id
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user's profile to find their Twitch ID and access token
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

    const twitchToken = profile.twitch_access_token;
    const broadcasterId = profile.twitch_id;

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "subscribe";

    if (action === "subscribe") {
      // Build the webhook callback URL — must be publicly accessible
      const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twitch-eventsub-webhook`;

      const subRes = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${twitchToken}`,
          "Client-Id": TWITCH_CLIENT_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: EVENTSUB_TYPE,
          version: "1",
          condition: {
            broadcaster_user_id: broadcasterId,
          },
          transport: {
            method: "webhook",
            callback: callbackUrl,
            secret: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(0, 32),
          },
        }),
      });

      if (!subRes.ok) {
        const errText = await subRes.text();
        return new Response(JSON.stringify({ error: `Twitch API error: ${errText}` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const subData = await subRes.json();
      const subscriptionId = subData?.data?.[0]?.id;

      if (subscriptionId) {
        // Store the subscription in the database
        await supabase.from("twitch_eventsub_subscriptions").insert({
          user_id: user.id,
          subscription_id: subscriptionId,
          subscription_type: EVENTSUB_TYPE,
          status: "pending",
        });
      }

      return new Response(JSON.stringify({ success: true, subscription_id: subscriptionId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unsubscribe") {
      // Find existing subscriptions for this user
      const { data: subs } = await supabase
        .from("twitch_eventsub_subscriptions")
        .select("id, subscription_id")
        .eq("user_id", user.id)
        .eq("subscription_type", EVENTSUB_TYPE)
        .in("status", ["enabled", "pending"]);

      if (subs && subs.length > 0) {
        for (const sub of subs) {
          // Delete from Twitch
          await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${sub.subscription_id}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${twitchToken}`,
              "Client-Id": TWITCH_CLIENT_ID,
            },
          });
        }

        // Mark as disabled in DB
        await supabase
          .from("twitch_eventsub_subscriptions")
          .update({ status: "disabled" })
          .eq("user_id", user.id)
          .eq("subscription_type", EVENTSUB_TYPE);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
