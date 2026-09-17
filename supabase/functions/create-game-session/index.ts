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

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: profile } = await supabase.from("profiles").select("twitch_id, twitch_username").eq("id", user.id).maybeSingle();
    if (!profile?.twitch_id) {
      return new Response(JSON.stringify({ error: "twitch not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { game_id = "parachute" } = await req.json().catch(() => ({}));
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const sessionToken = randomToken();
    const { data, error: insertError } = await supabase.from("game_sessions").insert({
      streamer_user_id: user.id,
      streamer_twitch_id: profile.twitch_id,
      streamer_twitch_username: profile.twitch_username,
      game_id,
      token: sessionToken,
      expires_at: expiresAt,
    }).select("token, expires_at").maybeSingle();
    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ token: data?.token, expires_at: data?.expires_at }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});