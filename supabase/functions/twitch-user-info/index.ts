import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TWITCH_WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

async function gqlRequest(query: string, retries = 2): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Id": TWITCH_WEB_CLIENT_ID,
        },
        body: JSON.stringify({ query }),
      });
      if (res.status === 429) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        return null;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

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

    // Single combined query: account creation + follow date in one request
    const followField = channel
      ? `follow(targetLogin: "${channel}") { followedAt }`
      : "";
    const query = `{ user(login: "${login}") { createdAt ${followField} } }`;

    const json = await gqlRequest(query);
    const user = (json?.data as Record<string, unknown> | undefined)?.user as Record<string, unknown> | null;
    const createdAt = (user?.createdAt as string) ?? null;
    const followedAt = (user?.follow as Record<string, unknown> | null)?.followedAt as string | null ?? null;

    return new Response(JSON.stringify({ login, createdAt, followedAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, createdAt: null, followedAt: null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
