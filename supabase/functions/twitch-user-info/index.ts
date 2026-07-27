import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TWITCH_WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const login = (url.searchParams.get("login") ?? "").trim().toLowerCase().replace(/^#/, "");
    const channel = (url.searchParams.get("channel") ?? "").trim().toLowerCase().replace(/^#/, "");
    if (!login) {
      return new Response(JSON.stringify({ error: "missing login" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gqlRes = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": TWITCH_WEB_CLIENT_ID,
      },
      body: JSON.stringify({
        query: `{ user(login: "${login}") { createdAt } }`,
      }),
    });

    if (!gqlRes.ok) {
      return new Response(JSON.stringify({ login, createdAt: null, followedAt: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await gqlRes.json();
    const user = json?.data?.user ?? null;
    const createdAt = user?.createdAt ?? null;
    const followedAt = null;

    return new Response(JSON.stringify({ login, createdAt, followedAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, createdAt: null, followedAt: null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
