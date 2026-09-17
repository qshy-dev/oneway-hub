import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers });
const clientId = Deno.env.get("TWITCH_CLIENT_ID") ?? "";
const clientSecret = Deno.env.get("TWITCH_CLIENT_SECRET") ?? "";
const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twitch-bot-auth`;
const botLogin = Deno.env.get("TWITCH_BOT_USERNAME") || "onewaymod";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const url = new URL(req.url);
    // Only the trusted runtime may refresh the shared token. Never return it.
    if (
      req.method === "POST" &&
      req.headers.get("X-Bot-Runtime-Secret") ===
        Deno.env.get("BOT_RUNTIME_SECRET")
    ) {
      const input = await req.json();
      if (input.action !== "runtime_refresh")
        return json({ error: "Unknown runtime action" }, 400);
      const { data: bot } = await db
        .from("bot_config")
        .select("id,refresh_token")
        .eq("bot_username", botLogin)
        .single();
      if (!bot?.refresh_token)
        return json({ error: "Bot must be authorized again" }, 409);
      const refreshed = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: bot.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!refreshed.ok)
        return json({ error: "Bot must be authorized again" }, 409);
      const tokens = await refreshed.json();
      const { error } = await db
        .from("bot_config")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(
            Date.now() + tokens.expires_in * 1000,
          ).toISOString(),
          scopes: tokens.scope,
        })
        .eq("id", bot.id);
      if (error) throw new Error("Failed to save refreshed credentials");
      return json({ success: true });
    }
    if (url.searchParams.has("code") || url.searchParams.has("error")) {
      const state = url.searchParams.get("state");
      if (!state) return json({ error: "Missing OAuth state" }, 400);
      const { data: saved } = await db
        .from("bot_oauth_states")
        .delete()
        .eq("state", state)
        .gt("expires_at", new Date().toISOString())
        .select("return_to")
        .maybeSingle();
      if (!saved)
        return json(
          { error: "OAuth request expired. Start authorization again." },
          400,
        );
      if (url.searchParams.has("error"))
        return json({ error: "Авторизация Twitch отменена." }, 400);
      const res = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: url.searchParams.get("code")!,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });
      if (!res.ok) return json({ error: "Не удалось авторизовать бота." }, 502);
      const tokens = await res.json();
      const identityRes = await fetch("https://api.twitch.tv/helix/users", {
        headers: {
          "Client-Id": clientId,
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      if (!identityRes.ok)
        return json({ error: "Не удалось проверить аккаунт бота." }, 502);
      const identity = (await identityRes.json()).data?.[0];
      if (!identity || identity.login !== botLogin.toLowerCase())
        return json(
          { error: `Войдите в Twitch под аккаунтом ${botLogin}.` },
          403,
        );
      if (
        !["chat:read", "chat:edit"].every((scope) =>
          tokens.scope?.includes(scope),
        )
      )
        return json(
          { error: "Не предоставлены разрешения чтения и отправки сообщений." },
          403,
        );
      const { error } = await db
        .from("bot_config")
        .upsert(
          {
            bot_username: identity.login,
            bot_twitch_user_id: identity.id,
            bot_display_name: identity.display_name,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            scopes: tokens.scope,
            expires_at: new Date(
              Date.now() + tokens.expires_in * 1000,
            ).toISOString(),
            client_id: clientId,
            connected: true,
          },
          { onConflict: "bot_username" },
        );
      if (error) throw new Error("Не удалось сохранить авторизацию.");
      const target = new URL(saved.return_to);
      target.searchParams.set("bot_auth", "success");
      return new Response(null, {
        status: 302,
        headers: { Location: target.toString(), "Cache-Control": "no-store" },
      });
    }
    const {
      data: { user },
    } = await db.auth.getUser(
      (req.headers.get("Authorization") ?? "").replace(/^Bearer /i, ""),
    );
    if (!user) return json({ error: "Войдите через Twitch." }, 401);
    const body =
      req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || url.searchParams.get("action") || "check";
    const admin = (Deno.env.get("BOT_ADMIN_USER_IDS") ?? "")
      .split(",")
      .map((s) => s.trim())
      .includes(user.id);
    const { data: config, error: configError } = await db
      .from("bot_config")
      .select(
        "id,bot_username,bot_display_name,bot_twitch_user_id,connected,scopes",
      )
      .eq("bot_username", botLogin)
      .maybeSingle();
    if (configError) throw new Error("Примените обновления базы данных бота.");
    if (action === "check") {
      const { data: channels, error } = await db
        .from("bot_channels")
        .select("*")
        .eq("owner_id", user.id);
      if (error) throw new Error("Не удалось загрузить подключение канала.");
      return json({ config, channels: channels ?? [], can_authorize: admin });
    }
    if (action === "oauth_url") {
      if (!admin)
        return json(
          { error: "Авторизацию общего бота выполняет администратор сайта." },
          403,
        );
      if (!clientId || !clientSecret)
        throw new Error("Не настроено приложение Twitch.");
      const origin = Deno.env.get("SITE_URL") || req.headers.get("Origin");
      if (!origin) throw new Error("Откройте авторизацию со страницы сайта.");
      const returnOrigin = new URL(origin);
      if (
        returnOrigin.protocol !== "https:" &&
        !(
          returnOrigin.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(returnOrigin.hostname)
        )
      )
        throw new Error("Недопустимый адрес возврата.");
      const returnTo = new URL("/bot", origin).toString();
      const state = crypto.randomUUID();
      const { error } = await db
        .from("bot_oauth_states")
        .insert({ state, user_id: user.id, return_to: returnTo });
      if (error) throw new Error("Не удалось начать авторизацию.");
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope:
          "chat:read chat:edit user:read:chat user:write:chat user:bot moderator:read:chatters",
        force_verify: "true",
        state,
      });
      return json({
        auth_url: `https://id.twitch.tv/oauth2/authorize?${params}`,
      });
    }
    if (action === "connect" || action === "disconnect") {
      if (req.method !== "POST") return json({ error: "POST required" }, 405);
      const { data: profile } = await db
        .from("profiles")
        .select("twitch_id,twitch_username")
        .eq("id", user.id)
        .single();
      if (!profile?.twitch_id || !profile.twitch_username)
        throw new Error("Канал Twitch не найден.");
      if (action === "disconnect") {
        const { error } = await db
          .from("bot_channels")
          .update({ enabled: false, connection_status: "disconnecting" })
          .eq("owner_id", user.id);
        if (error) throw new Error("Не удалось отключить канал.");
      } else {
        if (!config?.connected)
          throw new Error("Аккаунт бота ещё не авторизован администратором.");
        if (
          !["chat:read", "chat:edit"].every((scope) =>
            config.scopes?.includes(scope),
          )
        )
          throw new Error(
            "Администратору необходимо повторно авторизовать бота с разрешениями IRC.",
          );
        const { data: existing } = await db
          .from("bot_channels")
          .select("id")
          .eq("owner_id", user.id)
          .eq("channel_name", profile.twitch_username)
          .maybeSingle();
        const values = {
          bot_config_id: config.id,
          owner_id: user.id,
          twitch_channel_id: profile.twitch_id,
          channel_name: profile.twitch_username.toLowerCase(),
          enabled: true,
          connection_status: "connecting",
          last_error: null,
        };
        const result = existing
          ? await db.from("bot_channels").update(values).eq("id", existing.id)
          : await db.from("bot_channels").insert(values);
        if (result.error)
          throw new Error("Не удалось сохранить подключение канала.");
      }
      return json({ success: true });
    }
    if (action === "send") {
      if (req.method !== "POST") return json({ error: "POST required" }, 405);
      const message = String(body.message ?? "").trim();
      if (!message || message.length > 450 || /[\r\n]/.test(message))
        return json(
          {
            error:
              "Сообщение должно содержать от 1 до 450 символов без переносов строк.",
          },
          400,
        );
      const { data: channel } = await db
        .from("bot_channels")
        .select("channel_name,heartbeat_at")
        .eq("owner_id", user.id)
        .eq("enabled", true)
        .eq("connection_status", "connected")
        .maybeSingle();
      if (
        !channel?.heartbeat_at ||
        Date.now() - Date.parse(channel.heartbeat_at) > 45000
      )
        throw new Error("Бот пока не подключён к каналу.");
      const { count } = await db
        .from("bot_outbox")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .gte("created_at", new Date(Date.now() - 30000).toISOString());
      if ((count ?? 0) >= 5)
        return json(
          { error: "Подождите перед отправкой следующего сообщения." },
          429,
        );
      const { error } = await db
        .from("bot_outbox")
        .insert({
          owner_id: user.id,
          channel_name: channel.channel_name,
          message,
        });
      if (error) throw new Error("Не удалось отправить сообщение.");
      return json({ success: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Сервис бота недоступен." },
      500,
    );
  }
});
