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
    const { token, streamer_twitch_id, chatter_twitch_id, chatter_twitch_username, chatter_display_name, chatter_color, game_id, score, stars, duration_ms, hit } = body;
    if (!token || !streamer_twitch_id || !chatter_twitch_id || !game_id) {
      return new Response(JSON.stringify({ error: "missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Validate session token
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("streamer_twitch_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (new Date(session.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "token expired" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (session.streamer_twitch_id !== streamer_twitch_id) {
      return new Response(JSON.stringify({ error: "token mismatch" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data, error } = await supabase.from("game_results").insert({
      streamer_twitch_id,
      chatter_twitch_id,
      chatter_twitch_username,
      chatter_display_name,
      chatter_color,
      game_id,
      score: Number(score) || 0,
      stars: Number(stars) || 0,
      duration_ms: Number(duration_ms) || null,
      hit: Boolean(hit),
    }).select("id").maybeSingle();
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: true, id: data?.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});