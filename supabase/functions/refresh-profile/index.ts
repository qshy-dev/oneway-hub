import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Public Client-ID of this site's Twitch OAuth app
const TWITCH_CLIENT_ID =
  Deno.env.get("TWITCH_CLIENT_ID") ?? "ywfoa5xclxzqvlu1p7ppdrjrb3kgkh";
// Twitch's anonymous web GraphQL client (fallback)
const TWITCH_WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  type: string;
  broadcaster_type: string;
  description: string | null;
  profile_image_url: string | null;
  offline_image_url: string | null;
  view_count: number;
  created_at: string | null;
  email: string | null;
}

interface TwitchChannel {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  broadcaster_language: string;
  game_id: string | null;
  game_name: string | null;
  title: string | null;
  delay: number | null;
  tags: string[] | null;
}

interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: "live" | "rerun" | "vodcast";
  title: string;
  tags: string[];
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  is_mature: boolean;
}

interface TwitchVideosResponse {
  data: Array<{
    id: string;
    user_id: string;
    user_login: string;
    user_name: string;
    title: string;
    description: string;
    created_at: string;
    published_at: string;
    url: string;
    thumbnail_url: string;
    viewable: string;
    view_count: number;
    language: string;
    type: string;
    duration: string;
    muted_segments: unknown | null;
  }>;
  pagination?: { cursor: string };
}

interface TwitchTeamsResponse {
  data: Array<{ id: string; name: string; display_name: string }>;
}

interface TwitchEmotesResponse {
  data: Array<{ id: string; name: string; images: { url_1x: string; url_2x: string; url_4x: string }; emote_type: string; emote_set_id: string; owner_id: string; format: string[]; scale: string[]; theme_mode: string[] }>;
}

async function helixGet(
  url: string,
  clientId: string,
  accessToken: string | null,
): Promise<Response> {
  const headers: Record<string, string> = { "Client-Id": clientId };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  return fetch(url, { headers });
}

async function fetchTwitchUser(
  id: string | null,
  login: string | null,
  accessToken: string | null,
): Promise<TwitchUser | null> {
  // Try Helix /users with id first (most authoritative)
  if (id && accessToken && TWITCH_CLIENT_ID) {
    try {
      const res = await helixGet(
        `https://api.twitch.tv/helix/users?id=${encodeURIComponent(id)}`,
        TWITCH_CLIENT_ID,
        accessToken,
      );
      if (res.ok) {
        const data = await res.json();
        const u = data?.data?.[0];
        if (u) return u as TwitchUser;
      }
    } catch {
      // fall through
    }
  }

  // Fallback: Helix /users by login (works with app token or user token)
  if (login && TWITCH_CLIENT_ID) {
    try {
      const res = await helixGet(
        `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`,
        TWITCH_CLIENT_ID,
        accessToken,
      );
      if (res.ok) {
        const data = await res.json();
        const u = data?.data?.[0];
        if (u) return u as TwitchUser;
      }
    } catch {
      // fall through
    }
  }

  // Last resort: anonymous GQL (limited fields, no token)
  if (!login) return null;
  const query = `{ user(login: "${login}") { displayName login createdAt description profileImageURL(width: 300) offlineImageURL(width: 1920) viewCount roles { isPartner isAffiliate } } }`;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Id": TWITCH_WEB_CLIENT_ID },
        body: JSON.stringify({ query }),
      });
      if (res.status === 429) {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        return null;
      }
      if (!res.ok) return null;
      const json = (await res.json()) as Record<string, unknown>;
      const u = (json?.data as Record<string, unknown> | undefined)?.user as Record<string, unknown> | null;
      if (u) {
        return {
          id: id ?? "",
          login: (u.login as string) ?? login,
          display_name: (u.displayName as string) ?? login,
          type: "",
          broadcaster_type: ((u.roles as Record<string, unknown> | undefined)?.isPartner ? "partner" : (u.roles as Record<string, unknown> | undefined)?.isAffiliate ? "affiliate" : "") ?? "",
          description: (u.description as string) ?? null,
          profile_image_url: (u.profileImageURL as string) ?? null,
          offline_image_url: (u.offlineImageURL as string) ?? null,
          view_count: (u.viewCount as number) ?? 0,
          created_at: (u.createdAt as string) ?? null,
          email: null,
        } as TwitchUser;
      }
      return null;
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function fetchTwitchChannel(
  broadcasterId: string,
  accessToken: string | null,
): Promise<TwitchChannel | null> {
  if (!TWITCH_CLIENT_ID) return null;
  try {
    const res = await helixGet(
      `https://api.twitch.tv/helix/channels?broadcaster_id=${encodeURIComponent(broadcasterId)}`,
      TWITCH_CLIENT_ID,
      accessToken,
    );
    if (res.ok) {
      const data = await res.json();
      const c = data?.data?.[0];
      if (c) return c as TwitchChannel;
    }
  } catch {
    // ignore
  }
  return null;
}

async function fetchTwitchStream(
  userId: string,
  accessToken: string | null,
): Promise<TwitchStream | null> {
  if (!TWITCH_CLIENT_ID) return null;
  try {
    const res = await helixGet(
      `https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(userId)}`,
      TWITCH_CLIENT_ID,
      accessToken,
    );
    if (res.ok) {
      const data = await res.json();
      const s = data?.data?.[0];
      if (s) return s as TwitchStream;
    }
  } catch {
    // ignore
  }
  return null;
}

async function fetchTwitchFollowersCount(
  broadcasterId: string,
  accessToken: string | null,
): Promise<number | null> {
  if (!TWITCH_CLIENT_ID || !accessToken) return null;
  try {
    const res = await helixGet(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(broadcasterId)}&first=1`,
      TWITCH_CLIENT_ID,
      accessToken,
    );
    if (res.ok) {
      const data = await res.json();
      return data?.total ?? null;
    }
    if (res.status === 403) {
      // Missing moderator:read:followers scope - don't retry
      return null;
    }
  } catch {
    // ignore
  }
  return null;
}

async function fetchTwitchFollowedCount(
  userId: string,
  clientId: string,
  accessToken: string | null,
): Promise<number | null> {
  if (!clientId || !accessToken) return null;
  try {
    const res = await helixGet(
      `https://api.twitch.tv/helix/channels/followed?user_id=${encodeURIComponent(userId)}&first=1`,
      clientId,
      accessToken,
    );
    if (res.ok) {
      const data = await res.json();
      return data?.total ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}

async function fetchTwitchVideos(
  userId: string,
  accessToken: string | null,
): Promise<{ count: number; totalViews: number; latest: TwitchVideosResponse["data"][0] | null }> {
  if (!TWITCH_CLIENT_ID) return { count: 0, totalViews: 0, latest: null };
  let count = 0;
  let totalViews = 0;
  let latest: TwitchVideosResponse["data"][0] | null = null;
  let cursor: string | undefined;
  // Fetch up to 5 pages (500 videos max) to get accurate counts
  for (let page = 0; page < 5; page++) {
    try {
      const params = new URLSearchParams({ user_id: userId, first: "100", sort: "time" });
      if (cursor) params.set("after", cursor);
      const res = await helixGet(
        `https://api.twitch.tv/helix/videos?${params}`,
        TWITCH_CLIENT_ID,
        accessToken,
      );
      if (!res.ok) break;
      const data = await res.json() as TwitchVideosResponse;
      const videos = data?.data ?? [];
      if (videos.length === 0) break;
      if (!latest) latest = videos[0];
      for (const v of videos) {
        count++;
        totalViews += v.view_count ?? 0;
      }
      cursor = data?.pagination?.cursor;
      if (!cursor) break;
    } catch {
      break;
    }
  }
  return { count, totalViews, latest };
}

async function fetchTwitchTeams(
  broadcasterId: string,
  accessToken: string | null,
): Promise<string[]> {
  if (!TWITCH_CLIENT_ID) return [];
  try {
    const res = await helixGet(
      `https://api.twitch.tv/helix/teams/channel?broadcaster_id=${encodeURIComponent(broadcasterId)}`,
      TWITCH_CLIENT_ID,
      accessToken,
    );
    if (res.ok) {
      const data = await res.json() as TwitchTeamsResponse;
      return (data?.data ?? []).map((t) => t.name);
    }
  } catch {
    // ignore
  }
  return [];
}

async function fetchTwitchEmotes(
  broadcasterId: string,
  accessToken: string | null,
): Promise<number> {
  if (!TWITCH_CLIENT_ID) return 0;
  try {
    const res = await helixGet(
      `https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${encodeURIComponent(broadcasterId)}`,
      TWITCH_CLIENT_ID,
      accessToken,
    );
    if (res.ok) {
      const data = await res.json() as TwitchEmotesResponse;
      return (data?.data ?? []).length;
    }
  } catch {
    // ignore
  }
  return 0;
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
    const { data: profile } = await supabase
      .from("profiles")
      .select("twitch_id, twitch_username, twitch_access_token")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.twitch_username) {
      return new Response(JSON.stringify({ error: "twitch not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const twitchId = profile.twitch_id;
    const twitchUsername = profile.twitch_username;
    const accessToken = profile.twitch_access_token ?? null;

    // Fetch all data in parallel where possible
    const [userData, channelData, streamData, followersCount, followedCount, videosData, teamsData, emotesCount] = await Promise.all([
      fetchTwitchUser(twitchId, twitchUsername, accessToken),
      twitchId ? fetchTwitchChannel(twitchId, accessToken) : Promise.resolve(null),
      twitchId ? fetchTwitchStream(twitchId, accessToken) : Promise.resolve(null),
      twitchId ? fetchTwitchFollowersCount(twitchId, accessToken) : Promise.resolve(null),
      twitchId ? fetchTwitchFollowedCount(twitchId, TWITCH_CLIENT_ID, accessToken) : Promise.resolve(null),
      twitchId ? fetchTwitchVideos(twitchId, accessToken) : Promise.resolve({ count: 0, totalViews: 0, latest: null }),
      twitchId ? fetchTwitchTeams(twitchId, accessToken) : Promise.resolve([]),
      twitchId ? fetchTwitchEmotes(twitchId, accessToken) : Promise.resolve(0),
    ]);

    if (!userData || !userData.display_name) {
      return new Response(JSON.stringify({ error: "user not found on twitch" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const username = (userData.login || twitchUsername).toLowerCase();
    const displayName = userData.display_name;

    // Prepare update object with available columns (schema migration pending)
    const updateData: Record<string, unknown> = {
      twitch_username: username,
      twitch_display_name: displayName,
      twitch_avatar: userData.profile_image_url ?? null,
      twitch_broadcaster_type: userData.broadcaster_type ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, display_name: displayName, username }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});