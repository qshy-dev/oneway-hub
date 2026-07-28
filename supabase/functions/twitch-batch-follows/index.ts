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
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const channel: string = (body?.channel ?? "").trim().toLowerCase().replace(/^#/, "");
    const usernames: string[] = Array.isArray(body?.usernames) ? body.usernames : [];

    if (!channel) {
      return new Response(JSON.stringify({ error: "missing channel" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (usernames.length === 0) {
      return new Response(JSON.stringify({ channel, statuses: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const capped = usernames.slice(0, 100);

    const batch = capped.map((login) => {
      const cleanLogin = String(login).trim().toLowerCase().replace(/^#/, "");
      return {
        query: `query { user(login: "${cleanLogin}") { follow(targetLogin: "${channel}") { followedAt } } }`,
        variables: {},
      };
    });

    const gqlRes = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": TWITCH_WEB_CLIENT_ID,
      },
      body: JSON.stringify(batch),
    });

    if (!gqlRes.ok) {
      const statuses: Record<string, boolean> = {};
      for (const u of capped) statuses[u] = false;
      return new Response(JSON.stringify({ channel, statuses }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await gqlRes.json();
    const statuses: Record<string, boolean> = {};
    for (let i = 0; i < capped.length; i++) {
      const user = data?.[i]?.data?.user;
      statuses[capped[i]] = !!(user?.follow?.followedAt);
    }

    return new Response(JSON.stringify({ channel, statuses }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, statuses: {} }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
