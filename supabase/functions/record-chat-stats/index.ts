import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    const body = await req.json();
    const { token, streamer_twitch_id, items, emoji_items } = body;
    if (!token || !streamer_twitch_id || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: session } = await supabase.from("game_sessions").select("streamer_twitch_id, expires_at").eq("token", token).maybeSingle();
    if (!session || session.streamer_twitch_id !== streamer_twitch_id || new Date(session.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const rows = items.map((it: { streamer_twitch_username?: string; chatter_twitch_id: string; chatter_twitch_username: string; chatter_display_name: string; message_count: number; last_seen_at: string; top_7tv_emotes?: Record<string, number> }) => ({
      streamer_twitch_id,
      streamer_twitch_username: it.streamer_twitch_username ?? null,
      chatter_twitch_id: it.chatter_twitch_id,
      chatter_twitch_username: it.chatter_twitch_username,
      chatter_display_name: it.chatter_display_name,
      message_count: Number(it.message_count) || 0,
      last_seen_at: it.last_seen_at ? new Date(it.last_seen_at).toISOString() : new Date().toISOString(),
      top_7tv_emotes: it.top_7tv_emotes ?? {},
    }));
    const { error } = await supabase.from("chat_message_stats").upsert(rows, { onConflict: "streamer_twitch_id, chatter_twitch_id" });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (Array.isArray(emoji_items) && emoji_items.length > 0) {
      for (const it of emoji_items) {
        const { error: emojiError } = await supabase.rpc('increment_emoji_count', {
          p_streamer_twitch_id: streamer_twitch_id,
          p_chatter_twitch_id: it.chatter_twitch_id,
          p_emoji: it.emoji,
          p_is_7tv: Boolean(it.is_7tv),
          p_count: Number(it.count) || 0,
        });
        if (emojiError) {
          return new Response(JSON.stringify({ error: emojiError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
