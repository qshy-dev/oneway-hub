import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { collectAnalytics } from "../_shared/analytics.ts";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function equalConstantTime(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verify(req: Request, rawBody: string) {
  const secret = Deno.env.get("EVENTSUB_SECRET");
  const id = req.headers.get("Twitch-Eventsub-Message-Id") ?? "";
  const timestamp = req.headers.get("Twitch-Eventsub-Message-Timestamp") ?? "";
  const received = req.headers.get("Twitch-Eventsub-Message-Signature") ?? "";
  const messageType = req.headers.get("Twitch-Eventsub-Message-Type") ?? "";
  if (!secret || !id || !timestamp || !received || !messageType) return null;
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time) || Math.abs(Date.now() - time) > 10 * 60 * 1000) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(id + timestamp + rawBody),
  );
  if (!equalConstantTime(`sha256=${hex(signed)}`, received.toLowerCase())) return null;
  const { data: fresh, error } = await db.rpc("record_twitch_eventsub_message", {
    p_message_id: id,
    p_message_type: messageType,
  });
  if (error) throw error;
  return { messageType, fresh: Boolean(fresh) };
}

async function profileId(twitchId: string) {
  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("twitch_id", twitchId)
    .maybeSingle();
  return data?.id as string | undefined;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const rawBody = await req.text();
    const verified = await verify(req, rawBody);
    if (!verified) return new Response("Forbidden", { status: 403 });
    if (!verified.fresh) return new Response(null, { status: 204 });
    const body = JSON.parse(rawBody);
    const subscription = body?.subscription;

    if (verified.messageType === "webhook_callback_verification") {
      await db
        .from("twitch_eventsub_subscriptions")
        .update({ status: subscription?.status ?? "enabled" })
        .eq("subscription_id", subscription?.id ?? "");
      return new Response(body?.challenge ?? "", {
        status: body?.challenge ? 200 : 400,
        headers: { "Content-Type": "text/plain" },
      });
    }
    if (verified.messageType === "revocation") {
      await db
        .from("twitch_eventsub_subscriptions")
        .update({ status: subscription?.status ?? "revoked" })
        .eq("subscription_id", subscription?.id ?? "");
      return new Response(null, { status: 204 });
    }
    if (verified.messageType !== "notification") {
      return new Response(null, { status: 204 });
    }

    const event = body?.event;
    const broadcasterId = event?.broadcaster_user_id as string | undefined;
    const type = subscription?.type as string | undefined;
    if (!event || !broadcasterId || !type) return new Response(null, { status: 204 });
    const userId = await profileId(broadcasterId);
    if (!userId) return new Response(null, { status: 204 });

    if (type === "stream.offline") {
      await db
        .from("twitch_stream_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("ended_at", null);
    } else if (["stream.online", "channel.update"].includes(type)) {
      await collectAnalytics(db, userId);
    } else if (type === "channel.channel_points_custom_reward_redemption.add") {
      const redemptionId = event.id as string | undefined;
      const twitchUserId = event.user_id as string | undefined;
      const rewardCost = Number(event.reward?.cost ?? 0);
      if (redemptionId && twitchUserId && rewardCost > 0) {
        const { error } = await db.rpc("insert_auction_bid_for_streamer", {
          p_streamer_twitch_id: broadcasterId,
          p_twitch_user_id: twitchUserId,
          p_twitch_username: event.user_login ?? "",
          p_lot_id: null,
          p_lot_name: null,
          p_amount: rewardCost,
          p_input_text: event.user_input ?? "",
          p_matched: false,
          p_redemption_id: redemptionId,
        });
        if (error) throw error;
      }
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("EventSub webhook error", error);
    return new Response("Temporary failure", { status: 500 });
  }
});
