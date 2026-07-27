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
    const channel = (url.searchParams.get("channel") ?? "").trim().toLowerCase().replace(/^#/, "");
    if (!channel) {
      return new Response(JSON.stringify({ error: "missing channel" }), {
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
        query: `{ user(login: "${channel}") { stream { viewersCount } } }`,
      }),
    });

    if (!gqlRes.ok) {
      return new Response(JSON.stringify({ channel, live: false, viewers: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await gqlRes.json();
    const stream = data?.data?.user?.stream;
    const live = !!stream;
    const viewers = live ? stream.viewersCount : 0;

    return new Response(JSON.stringify({ channel, live, viewers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, live: false, viewers: null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
    });
  }
});
