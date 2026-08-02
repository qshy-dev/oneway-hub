import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, Twitch-Eventsub-Message-Id, Twitch-Eventsub-Message-Type, Twitch-Eventsub-Message-Signature, Twitch-Eventsub-Message-Timestamp",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const messageType = req.headers.get("Twitch-Eventsub-Message-Type");

    // Handle webhook verification challenge
    if (messageType === "webhook_callback_verification") {
      const body = await req.json();
      const challenge = body?.challenge;
      if (challenge) {
        return new Response(challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }
      return new Response("No challenge", { status: 400 });
    }

    // Only process notifications
    if (messageType !== "notification") {
      return new Response("OK", { status: 200 });
    }

    const body = await req.json();
    const subscription = body?.subscription;
    const event = body?.event;

    if (!event || !subscription) {
      return new Response("OK", { status: 200 });
    }

    // Extract redemption data from channel.channel_points_custom_reward_redemption.add event
    const redemptionId: string | undefined = event?.id;
    const userInput: string = event?.user_input ?? "";
    const twitchUserId: string = event?.user_id ?? "";
    const twitchUsername: string = event?.user_login ?? "";
    const rewardCost: number = event?.reward?.cost ?? 0;

    if (!redemptionId || !twitchUserId || rewardCost <= 0) {
      return new Response("OK", { status: 200 });
    }

    // Look up the streamer's user_id from the subscription's broadcaster_user_id
    const broadcasterId: string = event?.broadcaster_user_id ?? "";

    // Find the streamer's profile by twitch_id
    const { data: streamerProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("twitch_id", broadcasterId)
      .maybeSingle();

    if (!streamerProfile) {
      return new Response("OK", { status: 200 });
    }

    // Fetch the streamer's current auction lots from localStorage — but we can't access localStorage server-side.
    // Instead, we store the raw bid and let the frontend do the lot matching via realtime.
    // The frontend will receive this bid via realtime and run autoMatchLot.

    // Insert the bid using the SECURITY DEFINER RPC
    const { error } = await supabase.rpc("insert_auction_bid", {
      p_twitch_user_id: twitchUserId,
      p_twitch_username: twitchUsername,
      p_lot_id: null,
      p_lot_name: null,
      p_amount: rewardCost,
      p_input_text: userInput,
      p_matched: false,
      p_redemption_id: redemptionId,
    });

    if (error) {
      console.error("Failed to insert auction bid:", error.message);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err.message);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
