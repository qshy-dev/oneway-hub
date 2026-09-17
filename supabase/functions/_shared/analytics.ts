import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
let appToken: { value: string; until: number } | null = null;
export async function collectAnalytics(db: SupabaseClient, userId: string) {
  const clientId = Deno.env.get("TWITCH_CLIENT_ID");
  const secret = Deno.env.get("TWITCH_CLIENT_SECRET");
  if (!clientId || !secret)
    throw new Error("На сервере не настроена интеграция Twitch.");
  const { data: profile, error } = await db
    .from("profiles")
    .select("twitch_id,twitch_access_token")
    .eq("id", userId)
    .single();
  if (error || !profile?.twitch_id)
    throw new Error("Канал Twitch не подключён.");
  if (!appToken || appToken.until < Date.now()) {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error("Не удалось авторизовать приложение Twitch.");
    const value = await res.json();
    appToken = {
      value: value.access_token,
      until: Date.now() + (value.expires_in - 120) * 1000,
    };
  }
  const warnings: string[] = [];
  const userAccessToken = profile.twitch_access_token;
  async function get(
    path: string,
    label: string,
    userToken = false,
    optional = true,
  ) {
    const token = userToken ? userAccessToken : appToken!.value;
    if (!token) {
      warnings.push(`${label}: требуется повторный вход через Twitch.`);
      return null;
    }
    try {
      const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
        headers: { "Client-Id": clientId!, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 404 && path.startsWith("schedule"))
        return { data: { segments: [] } };
      if (!res.ok) {
        if (!optional)
          throw new Error(`Twitch временно недоступен (HTTP ${res.status}).`);
        warnings.push(
          `${label}: ${res.status === 401 || res.status === 403 ? "нет разрешения или истёк вход Twitch" : `источник недоступен (HTTP ${res.status})`}.`,
        );
        return null;
      }
      return await res.json();
    } catch (e) {
      if (!optional) throw e;
      warnings.push(`${label}: не удалось получить данные.`);
      return null;
    }
  }
  const id = encodeURIComponent(profile.twitch_id);
  const [streams, channel, followers, subscribers, videos, clips, schedule] =
    await Promise.all([
      get(`streams?user_id=${id}`, "Эфир", false, false),
      get(`channels?broadcaster_id=${id}`, "Канал"),
      get(`channels/followers?broadcaster_id=${id}&first=1`, "Фолловеры"),
      get(`subscriptions?broadcaster_id=${id}&first=1`, "Подписчики", true),
      get(`videos?user_id=${id}&type=archive&first=30`, "Записи эфиров"),
      get(
        `clips?broadcaster_id=${id}&first=20&started_at=${encodeURIComponent(new Date(Date.now() - 30 * 86400000).toISOString())}`,
        "Клипы",
      ),
      get(`schedule?broadcaster_id=${id}&first=20`, "Расписание"),
    ]);
  const stream = streams.data?.[0] ?? null;
  const sampled = await db.rpc("record_channel_sample", {
    p_user_id: userId,
    p_stream: stream,
  });
  if (sampled.error)
    throw new Error(
      "Не удалось сохранить замер. Примените миграции статистики.",
    );
  const snapshot = {
    updated_at: new Date().toISOString(),
    channel: channel?.data?.[0] ?? null,
    stream,
    followers: followers?.total ?? null,
    subscribers: subscribers?.total ?? null,
    videos: videos?.data ?? [],
    clips: clips?.data ?? [],
    schedule: schedule?.data?.segments ?? [],
    warnings,
  };
  const saved = await db
    .from("channel_analytics")
    .upsert({ user_id: userId, snapshot, updated_at: snapshot.updated_at });
  if (saved.error) throw new Error("Не удалось сохранить статистику.");
  const updated = await db
    .from("profiles")
    .update({
      twitch_is_live: !!stream,
      twitch_stream_viewer_count: stream?.viewer_count ?? 0,
      twitch_stream_started_at: stream?.started_at ?? null,
      ...(followers ? { twitch_follower_count: followers.total } : {}),
      twitch_data_updated_at: snapshot.updated_at,
    })
    .eq("id", userId);
  if (updated.error)
    warnings.push("Не удалось обновить краткую карточку профиля.");
  return snapshot;
}
