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
      body: JSON.stringify([
        {
          operationName: "ChannelShallowUser",
          variables: { login },
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash: "b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5",
            },
          },
        },
      ]),
    });

    if (!gqlRes.ok) {
      return new Response(JSON.stringify({ login, follows: [], total: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await gqlRes.json();
    const user = data?.[0]?.data?.user;

    if (!user) {
      return new Response(JSON.stringify({ login, follows: [], total: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const follows = user?.follows?.edges?.map((edge: any) => ({
      login: edge?.node?.login ?? "",
      displayName: edge?.node?.displayName ?? edge?.node?.login ?? "",
      avatar: edge?.node?.profileImageURL ?? null,
      followedAt: edge?.followedAt ?? null,
    })) ?? [];

    const total = user?.follows?.totalCount ?? follows.length;

    return new Response(JSON.stringify({ login, follows, total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, follows: [], total: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
