import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Provider-Token",
};

interface FollowEdge {
  followed_at: string;
  broadcaster_login: string;
  broadcaster_name: string;
  profile_image_url: string | null;
}

async function validateToken(providerToken: string): Promise<{ clientId: string; userId: string } | null> {
  try {
    const res = await fetch("https://id.twitch.tv/oauth2/validate", {
      headers: { Authorization: `Bearer ${providerToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { clientId: data.client_id, userId: data.user_id };
  } catch {
    return null;
  }
}

function helixHeaders(clientId: string, providerToken: string): Record<string, string> {
  const headers: Record<string, string> = { "Client-Id": clientId };
  if (providerToken) headers["Authorization"] = `Bearer ${providerToken}`;
  return headers;
}

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

    const providerToken = req.headers.get("X-Provider-Token") ?? "";

    if (!providerToken) {
      return new Response(JSON.stringify({ login, follows: [], total: 0, error: "no provider token" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the token to get the correct client_id and user_id
    const validated = await validateToken(providerToken);
    if (!validated) {
      return new Response(JSON.stringify({ login, follows: [], total: 0, error: "token validation failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clientId, userId } = validated;

    // Fetch followed channels via Helix (paginated, 100 per page)
    const follows: FollowEdge[] = [];
    let cursor: string | undefined;
    let total = 0;

    for (let page = 0; page < 10; page++) {
      const params = new URLSearchParams({ user_id: userId, first: "100" });
      if (cursor) params.set("after", cursor);

      const followRes = await fetch(
        `https://api.twitch.tv/helix/channels/followed?${params}`,
        { headers: helixHeaders(clientId, providerToken) },
      );

      if (!followRes.ok) {
        break;
      }

      const followData = await followRes.json();
      const edges = followData?.data ?? [];
      total = followData?.total ?? edges.length;

      for (const edge of edges) {
        follows.push({
          followed_at: edge.followed_at,
          broadcaster_login: edge.broadcaster_login,
          broadcaster_name: edge.broadcaster_name,
          profile_image_url: null,
        });
      }

      cursor = followData?.pagination?.cursor;
      if (!cursor || edges.length === 0) break;
    }

    // Fetch avatars in batches of 100 via Helix users endpoint
    for (let i = 0; i < follows.length; i += 100) {
      const batch = follows.slice(i, i + 100);
      const logins = batch.map((f) => f.broadcaster_login).join("&login=");
      const avatarRes = await fetch(
        `https://api.twitch.tv/helix/users?login=${logins}`,
        { headers: helixHeaders(clientId, providerToken) },
      );
      if (avatarRes.ok) {
        const avatarData = await avatarRes.json();
        const avatarMap: Record<string, string> = {};
        for (const u of avatarData?.data ?? []) {
          avatarMap[u.login.toLowerCase()] = u.profile_image_url;
        }
        for (const f of batch) {
          f.profile_image_url = avatarMap[f.broadcaster_login.toLowerCase()] ?? null;
        }
      }
    }

    const formatted = follows.map((f) => ({
      login: f.broadcaster_login,
      displayName: f.broadcaster_name,
      avatar: f.profile_image_url,
      followedAt: f.followed_at,
    }));

    return new Response(JSON.stringify({ login, follows: formatted, total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, follows: [], total: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
