import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Provider-Token",
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

    // The Twitch provider OAuth token from the user's Supabase session.
    // Required: the GQL follows.edges field returns empty without authentication.
    const providerToken = req.headers.get("X-Provider-Token") ?? "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Client-Id": TWITCH_WEB_CLIENT_ID,
    };
    if (providerToken) {
      headers["Authorization"] = `OAuth ${providerToken}`;
    }

    const gqlRes = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers,
      body: JSON.stringify({
        operationName: "ChannelShallowUser",
        variables: { login },
        query:
          "query ChannelShallowUser($login: String!) { user(login: $login) { follows(first: 100) { totalCount edges { followedAt node { login displayName profileImageURL(width: 70) } } } } }",
      }),
    });

    if (!gqlRes.ok) {
      return new Response(JSON.stringify({ login, follows: [], total: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await gqlRes.json();
    const user = data?.data?.user;

    if (!user) {
      return new Response(JSON.stringify({ login, follows: [], total: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const follows = user?.follows?.edges?.map((edge: Record<string, unknown>) => ({
      login: (edge.node as Record<string, unknown>)?.login ?? "",
      displayName: (edge.node as Record<string, unknown>)?.displayName ?? (edge.node as Record<string, unknown>)?.login ?? "",
      avatar: (edge.node as Record<string, unknown>)?.profileImageURL ?? null,
      followedAt: edge?.followedAt ?? null,
    })) ?? [];

    const total = user?.follows?.totalCount ?? follows.length;

    return new Response(JSON.stringify({ login, follows, total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, follows: [], total: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
