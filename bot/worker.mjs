import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { parseLine, safeMessage, commandReply } from "./protocol.mjs";

const env = process.env;
for (const key of [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "BOT_RUNTIME_SECRET",
]) {
  if (!env[key]) throw new Error(`Missing ${key}. See bot/README.md.`);
}
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const holder = randomUUID();
const botLogin = env.TWITCH_BOT_USERNAME || "onewaymod";
let socket = null,
  config = null,
  channels = [],
  commands = [],
  authenticated = false,
  busy = false,
  stopping = false;
let lastStats = 0,
  lastValidation = 0,
  lastReceived = 0,
  reconnectAt = 0,
  attempts = 0,
  lastCleanup = 0;
const joined = new Set(),
  requested = new Map(),
  cooldowns = new Map(),
  streamStarts = new Map();
const sendTimes = [];
let sendQueue = Promise.resolve();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checked = (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};

async function log(channel, message, kind = "event") {
  checked(
    await db
      .from("bot_messages")
      .insert({
        id: randomUUID(),
        owner_id: channel.owner_id,
        channel_name: channel.channel_name,
        username: botLogin,
        message,
        kind,
      }),
  );
}
function closeSocket() {
  const old = socket;
  socket = null;
  authenticated = false;
  joined.clear();
  requested.clear();
  if (old) {
    old.onclose = null;
    old.onmessage = null;
    old.onerror = null;
    old.close();
  }
}
async function fail(message) {
  closeSocket();
  reconnectAt =
    Date.now() + Math.min(60000, 2000 * 2 ** Math.min(attempts++, 5));
  checked(
    await db
      .from("bot_channels")
      .update({
        connection_status: "error",
        last_error: message,
        heartbeat_at: new Date().toISOString(),
      })
      .eq("enabled", true),
  );
}
async function send(channelName, text) {
  // One queue across all channels: stay below Twitch's normal-account rate limit.
  const task = sendQueue.then(async () => {
    if (!joined.has(channelName) || socket?.readyState !== WebSocket.OPEN)
      throw new Error("Канал не подключён");
    while (sendTimes.length && sendTimes[0] < Date.now() - 31000)
      sendTimes.shift();
    if (sendTimes.length >= 18)
      await sleep(Math.max(0, 31000 - (Date.now() - sendTimes[0])));
    await sleep(1100);
    if (!joined.has(channelName) || socket?.readyState !== WebSocket.OPEN)
      throw new Error("Соединение потеряно");
    socket.send(`PRIVMSG #${channelName} :${safeMessage(text)}\r\n`);
    sendTimes.push(Date.now());
  });
  sendQueue = task.catch(() => {});
  return task;
}
async function handleLine(line) {
  const msg = parseLine(line);
  if (!msg) return;
  if (msg.command === "PING") {
    socket?.send(`PONG :${msg.text}\r\n`);
    return;
  }
  if (msg.command === "RECONNECT") {
    await fail("Twitch запросил переподключение.");
    return;
  }
  if (msg.command === "001") {
    authenticated = true;
    attempts = 0;
    return;
  }
  const channelName = msg.params[0]?.replace(/^#/, "");
  const channel = channels.find(
    (c) => c.channel_name === channelName && c.enabled,
  );
  if (
    msg.command === "JOIN" &&
    msg.prefix.split("!")[0].toLowerCase() === botLogin.toLowerCase() &&
    channel
  ) {
    joined.add(channelName);
    requested.delete(channelName);
    checked(
      await db
        .from("bot_channels")
        .update({
          connection_status: "connected",
          heartbeat_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", channel.id),
    );
    await log(channel, "Twitch подтвердил присутствие бота в чате.");
    return;
  }
  if (msg.command === "NOTICE") {
    if (
      /authentication|login unsuccessful|improperly formatted auth/i.test(
        msg.text,
      )
    ) {
      lastValidation = 0;
      await fail(
        "Авторизация IRC отклонена. Повторно авторизуйте аккаунт бота.",
      );
    } else if (channel) await log(channel, msg.text, "error");
    return;
  }
  if (msg.command !== "PRIVMSG" || !channel || !msg.tags["user-id"]) return;
  const username = msg.tags["display-name"] || msg.prefix.split("!")[0];
  if (msg.tags["user-id"] === config.bot_twitch_user_id) return;
  checked(
    await db.rpc("record_bot_message", {
      p_id: msg.tags.id || randomUUID(),
      p_owner: channel.owner_id,
      p_channel: channelName,
      p_chatter: msg.tags["user-id"],
      p_username: username,
      p_message: msg.text,
      p_kind: "chat",
    }),
  );
  if (!msg.text.startsWith("!")) return;
  const reply = commandReply(
    msg.text,
    commands.filter((c) => c.owner_id === channel.owner_id),
    username,
    channelName,
    streamStarts.get(channelName),
  );
  if (!reply) return;
  const key = `${channelName}:${reply.name}`;
  if ((cooldowns.get(key) || 0) > Date.now()) return;
  cooldowns.set(key, Date.now() + reply.cooldown * 1000);
  await send(channelName, reply.text);
  await log(channel, `!${reply.name}: ${safeMessage(reply.text)}`, "command");
}
async function connect() {
  const ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
  socket = ws;
  lastReceived = Date.now();
  ws.onopen = () => {
    if (socket !== ws) return;
    ws.send(
      "CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership\r\n",
    );
    ws.send(`PASS oauth:${config.access_token}\r\n`);
    ws.send(`NICK ${botLogin}\r\n`);
  };
  ws.onmessage = (event) => {
    if (socket !== ws) return;
    lastReceived = Date.now();
    for (const line of String(event.data).split("\r\n").filter(Boolean))
      void handleLine(line).catch(() =>
        console.error(
          "Message handling failed; inspect database connectivity.",
        ),
      );
  };
  ws.onerror = () => {
    if (socket === ws)
      void fail("Не удалось соединиться с Twitch.").catch(() => {});
  };
  ws.onclose = () => {
    if (socket === ws)
      void fail("Соединение с Twitch закрыто.").catch(() => {});
  };
}
async function tokenConfig() {
  const next = checked(
    await db
      .from("bot_config")
      .select("*")
      .eq("bot_username", botLogin)
      .maybeSingle(),
  );
  if (!next?.connected) return null;
  if (
    !["chat:read", "chat:edit"].every((scope) => next.scopes?.includes(scope))
  )
    throw new Error(
      "Нужна повторная авторизация бота с разрешениями chat:read и chat:edit.",
    );
  if (!next.expires_at || Date.parse(next.expires_at) < Date.now() + 300000) {
    const res = await fetch(
      `${env.SUPABASE_URL}/functions/v1/twitch-bot-auth`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          "X-Bot-Runtime-Secret": env.BOT_RUNTIME_SECRET,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "runtime_refresh" }),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!res.ok)
      throw new Error(
        "Обновление токена бота отклонено. Повторите авторизацию.",
      );
    Object.assign(
      next,
      checked(
        await db.from("bot_config").select("*").eq("id", next.id).single(),
      ),
    );
  }
  if (
    Date.now() - lastValidation > 3600000 ||
    next.access_token !== config?.access_token
  ) {
    const valid = await fetch("https://id.twitch.tv/oauth2/validate", {
      headers: { Authorization: `OAuth ${next.access_token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!valid.ok)
      throw new Error("Токен бота недействителен. Повторите авторизацию.");
    const identity = await valid.json();
    if (identity.login !== botLogin || identity.client_id !== next.client_id)
      throw new Error("Аккаунт или приложение бота не совпадает с настройкой.");
    lastValidation = Date.now();
  }
  if (config?.access_token && next.access_token !== config.access_token)
    closeSocket();
  return next;
}
async function tick() {
  if (busy || stopping) return;
  busy = true;
  try {
    if (!checked(await db.rpc("acquire_bot_lease", { p_holder: holder }))) {
      closeSocket();
      return;
    }
    channels = checked(await db.from("bot_channels").select("*")) ?? [];
    commands = checked(await db.from("bot_commands").select("*")) ?? [];
    config = await tokenConfig();
    if (!config) {
      closeSocket();
      return;
    }
    const desired = channels.filter((c) => c.enabled);
    for (const channel of channels.filter((c) => !c.enabled)) {
      if (
        joined.has(channel.channel_name) &&
        socket?.readyState === WebSocket.OPEN
      )
        socket.send(`PART #${channel.channel_name}\r\n`);
      joined.delete(channel.channel_name);
      requested.delete(channel.channel_name);
      if (channel.connection_status !== "disconnected")
        checked(
          await db
            .from("bot_channels")
            .update({
              connection_status: "disconnected",
              heartbeat_at: new Date().toISOString(),
              last_error: null,
            })
            .eq("id", channel.id),
        );
    }
    if (!desired.length) {
      closeSocket();
      return;
    }
    if (!socket && Date.now() >= reconnectAt) await connect();
    if (socket && Date.now() - lastReceived > 180000) {
      await fail("Twitch перестал отвечать. Переподключение…");
      return;
    }
    if (authenticated && socket?.readyState === WebSocket.OPEN) {
      // At most 5 JOIN requests per 10 second tick.
      let joins = 0;
      for (const channel of desired) {
        const name = channel.channel_name;
        if (!/^[a-z0-9_]{1,25}$/.test(name)) continue;
        if (joined.has(name)) {
          checked(
            await db
              .from("bot_channels")
              .update({
                heartbeat_at: new Date().toISOString(),
                connection_status: "connected",
                last_error: null,
              })
              .eq("id", channel.id),
          );
          continue;
        }
        if (requested.has(name) && Date.now() - requested.get(name) < 30000)
          continue;
        if (joins++ >= 5) break;
        socket.send(`JOIN #${name}\r\n`);
        requested.set(name, Date.now());
        checked(
          await db
            .from("bot_channels")
            .update({
              connection_status: "connecting",
              last_error:
                channel.connection_status === "connecting"
                  ? "Ожидаем подтверждение входа в чат от Twitch."
                  : null,
            })
            .eq("id", channel.id),
        );
      }
      const outbox =
        checked(
          await db
            .from("bot_outbox")
            .select("*")
            .eq("status", "pending")
            .order("created_at")
            .limit(10),
        ) ?? [];
      for (const item of outbox) {
        const claimed = checked(
          await db
            .from("bot_outbox")
            .update({ status: "sending" })
            .eq("id", item.id)
            .eq("status", "pending")
            .select("id"),
        );
        if (!claimed?.length) continue;
        const channel = desired.find(
          (c) =>
            c.owner_id === item.owner_id &&
            c.channel_name === item.channel_name,
        );
        try {
          if (!channel || Date.now() - Date.parse(item.created_at) > 60000)
            throw new Error("Канал отключён или сообщение устарело.");
          await send(item.channel_name, item.message);
          checked(
            await db
              .from("bot_outbox")
              .update({ status: "sent" })
              .eq("id", item.id),
          );
          await log(channel, item.message, "sent");
        } catch (e) {
          checked(
            await db
              .from("bot_outbox")
              .update({ status: "failed", error: e.message })
              .eq("id", item.id),
          );
          if (channel) await log(channel, e.message, "error");
        }
      }
    }
    if (Date.now() - lastStats > 60000) {
      lastStats = Date.now();
      // Do not hold the lease-renewal tick while external APIs are slow.
      for (const channel of desired)
        void fetch(`${env.SUPABASE_URL}/functions/v1/twitch-channel-sync`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            "X-Bot-Runtime-Secret": env.BOT_RUNTIME_SECRET,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: channel.owner_id }),
          signal: AbortSignal.timeout(25000),
        })
          .then(async (res) => {
            if (!res.ok)
              throw new Error(
                "Статистика не обновлена. Проверьте функцию twitch-channel-sync.",
              );
            const snapshot = await res.json();
            streamStarts.set(
              channel.channel_name,
              snapshot.stream?.started_at ?? null,
            );
          })
          .catch((e) => log(channel, e.message, "error").catch(() => {}));
    }
    if (Date.now() - lastCleanup > 3600000) {
      lastCleanup = Date.now();
      checked(
        await db
          .from("bot_messages")
          .delete()
          .lt("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
      );
      checked(
        await db
          .from("bot_outbox")
          .update({
            status: "failed",
            error: "Отправка прервана; проверьте чат перед повтором.",
          })
          .eq("status", "sending")
          .lt("created_at", new Date(Date.now() - 120000).toISOString()),
      );
      checked(
        await db
          .from("bot_outbox")
          .delete()
          .lt("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
      );
      for (const [key, until] of cooldowns)
        if (until < Date.now()) cooldowns.delete(key);
    }
  } catch (e) {
    console.error("Bot runtime:", e.message);
    await fail(
      "Сервис бота временно недоступен. Проверьте авторизацию и журнал сервера.",
    ).catch(() => {});
  } finally {
    busy = false;
  }
}
const timer = setInterval(() => void tick(), 10000);
const leaseTimer = setInterval(async () => {
  if (stopping || !socket) return;
  try {
    if (!checked(await db.rpc("acquire_bot_lease", { p_holder: holder })))
      closeSocket();
  } catch {
    closeSocket();
  }
}, 10000);
async function stop() {
  stopping = true;
  clearInterval(timer);
  clearInterval(leaseTimer);
  closeSocket();
  await db.from("bot_runtime_lease").delete().eq("holder", holder);
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
console.log("Oneway bot runtime started.");
void tick();
