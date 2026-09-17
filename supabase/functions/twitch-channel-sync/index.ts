import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { collectAnalytics } from "../_shared/analytics.ts";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST")
    return new Response("{}", { status: 405, headers });
  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const bearer = (req.headers.get("Authorization") ?? "").replace(
      /^Bearer /i,
      "",
    );
    let userId: string;
    const runtimeSecret = req.headers.get("X-Bot-Runtime-Secret");
    if (
      runtimeSecret &&
      runtimeSecret === Deno.env.get("BOT_RUNTIME_SECRET")
    ) {
      const body = await req.json();
      const { data: channel } = await db
        .from("bot_channels")
        .select("owner_id")
        .eq("owner_id", body.user_id)
        .eq("enabled", true)
        .limit(1)
        .maybeSingle();
      if (!channel) return new Response("{}", { status: 403, headers });
      userId = channel.owner_id;
    } else {
      const {
        data: { user },
        error,
      } = await db.auth.getUser(bearer);
      if (error || !user)
        return new Response(
          JSON.stringify({ error: "Сессия истекла. Войдите через Twitch." }),
          { status: 401, headers },
        );
      userId = user.id;
    }
    const { data: cached } = await db
      .from("channel_analytics")
      .select("snapshot,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (cached && Date.now() - Date.parse(cached.updated_at) < 45000)
      return new Response(JSON.stringify(cached.snapshot), { headers });
    return new Response(JSON.stringify(await collectAnalytics(db, userId)), {
      headers,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Ошибка получения статистики.",
      }),
      { status: 502, headers },
    );
  }
});
