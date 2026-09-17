import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Power,
  RefreshCw,
  Send,
  Plus,
  Trash2,
  Terminal,
  Shield,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { callEdge } from "@/lib/edge";

interface Config {
  bot_username: string;
  connected: boolean;
  scopes: string[];
}
interface Channel {
  id: string;
  channel_name: string;
  enabled: boolean;
  connection_status: string;
  heartbeat_at: string | null;
  last_error: string | null;
}
interface Command {
  id: string;
  name: string;
  response: string;
  enabled: boolean;
  cooldown: number;
}
interface Message {
  id: string;
  username: string;
  message: string;
  kind: string;
  created_at: string;
}
interface State {
  config: Config | null;
  channels: Channel[];
  can_authorize: boolean;
}
const box = "rounded-2xl border border-ink-800 bg-ink-900/50 p-5 sm:p-6";
const input =
  "w-full rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-sm outline-none focus:border-accent-400";

export function BotChat() {
  const { user, profile, signInWithTwitch } = useAuth();
  const [state, setState] = useState<State | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [response, setResponse] = useState("");
  const [cooldown, setCooldown] = useState(10);
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [next, cmd, chat] = await Promise.all([
        callEdge<State>("twitch-bot-auth", { action: "check" }),
        supabase
          .from("bot_commands")
          .select("*")
          .eq("owner_id", user.id)
          .order("name"),
        supabase
          .from("bot_messages")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      setState(next);
      if (cmd.error || chat.error)
        throw new Error(
          "Не удалось загрузить команды или журнал. Проверьте обновления сервера.",
        );
      setCommands(cmd.data ?? []);
      setMessages(chat.data ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить бота.");
    }
  }, [user]);
  useEffect(() => {
    setState(null);
    setCommands([]);
    setMessages([]);
    if (!user) return;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10000);
    return () => clearInterval(timer);
  }, [load, user]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось выполнить действие.",
      );
    } finally {
      setBusy(false);
    }
  };
  const channel =
    state?.channels.find((c) => c.channel_name === profile?.twitch_username) ??
    state?.channels[0];
  const online =
    channel?.enabled &&
    channel.connection_status === "connected" &&
    !!channel.heartbeat_at &&
    Date.now() - Date.parse(channel.heartbeat_at) < 45000;
  const status = online
    ? "В чате канала"
    : channel?.enabled
      ? "Ожидание подключения"
      : channel?.connection_status === "disconnecting"
        ? "Отключение…"
        : "Отключён";
  if (!user)
    return (
      <div className={`${box} py-16 text-center`}>
        <Bot className="mx-auto h-12 w-12 text-accent-400" />
        <h1 className="mt-5 text-2xl font-bold">Помощник вашего чата</h1>
        <p className="mt-3 text-ink-400">
          Команды, общение и сбор статистики в одном месте.
        </p>
        <button
          onClick={signInWithTwitch}
          className="mt-6 rounded-xl bg-accent-500 px-6 py-3 font-semibold"
        >
          Войти через Twitch
        </button>
      </div>
    );
  return (
    <section className="space-y-6">
      <div className={`${box} bg-gradient-to-br from-accent-500/10 to-ink-950`}>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-accent-500/15 p-4">
              <Bot className="h-8 w-8 text-accent-300" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[.2em] text-ink-500">
                ONEWAY / CHAT BOT
              </p>
              <h1 className="mt-1 text-2xl font-bold">
                Бот для{" "}
                {profile?.twitch_display_name || profile?.twitch_username}
              </h1>
              <p className="mt-2 text-sm text-ink-400">
                @{state?.config?.bot_username || "onewaymod"}{" "}
                <span className={online ? "text-emerald-400" : "text-ink-500"}>
                  · {status}
                </span>
              </p>
            </div>
          </div>
          <button
            disabled={busy || !state?.config?.connected}
            onClick={() =>
              void run(async () => {
                await callEdge("twitch-bot-auth", {
                  action: channel?.enabled ? "disconnect" : "connect",
                });
              })
            }
            className={`flex items-center gap-2 rounded-xl px-5 py-3 font-semibold disabled:opacity-40 ${channel?.enabled ? "border border-red-500/30 text-red-300" : "bg-accent-500 text-white"}`}
          >
            <Power className="h-4 w-4" />
            {channel?.enabled ? "Отключить от канала" : "Подключить к каналу"}
          </button>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-300"
        >
          {error}
          <button
            onClick={() => void load()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Повторить
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-300">
          {notice}
        </p>
      )}
      {state && !state.config?.connected && (
        <div className={box}>
          <h2 className="font-semibold">Аккаунт бота ещё не подключён</h2>
          <p className="mt-2 text-sm text-ink-400">
            Администратору сайта нужно один раз авторизовать аккаунт бота в
            Twitch.
          </p>
          {state.can_authorize && (
            <button
              onClick={() =>
                void run(async () => {
                  const data = await callEdge<{ auth_url: string }>(
                    "twitch-bot-auth",
                    { action: "oauth_url" },
                  );
                  window.location.assign(data.auth_url);
                })
              }
              className="mt-4 rounded-lg bg-accent-500 px-4 py-2"
            >
              Авторизовать бота
            </button>
          )}
        </div>
      )}
      {state?.config?.connected &&
        !state.config.scopes?.includes("chat:read") && (
          <div className={box}>
            <p className="text-sm text-amber-300">
              Разрешения бота устарели. Администратору необходимо повторить
              авторизацию.
            </p>
            {state.can_authorize && (
              <button
                onClick={() =>
                  void run(async () => {
                    const data = await callEdge<{ auth_url: string }>(
                      "twitch-bot-auth",
                      { action: "oauth_url" },
                    );
                    window.location.assign(data.auth_url);
                  })
                }
                className="mt-3 rounded-lg bg-accent-500 px-4 py-2"
              >
                Обновить разрешения
              </button>
            )}
          </div>
        )}
      {channel?.last_error && (
        <p role="alert" className="text-sm text-amber-300">
          {channel.last_error}
        </p>
      )}
      <nav aria-label="Управление ботом" className="flex flex-wrap gap-2">
        {[
          ["overview", "Обзор"],
          ["commands", "Команды"],
          ["chat", "Чат"],
          ["logs", "Журнал"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${tab === key ? "bg-accent-500 text-white" : "border border-ink-800 text-ink-400"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "overview" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Power, title: "Подключение", value: status },
              {
                icon: Terminal,
                title: "Свои команды",
                value: `${commands.filter((c) => c.enabled).length} активных`,
              },
              {
                icon: MessageSquare,
                title: "Последняя активность",
                value: messages[0]
                  ? new Date(messages[0].created_at).toLocaleTimeString()
                  : "Пока нет",
              },
            ].map((item) => (
              <div key={item.title} className={box}>
                <item.icon className="h-5 w-5 text-accent-400" />
                <p className="mt-5 text-sm text-ink-500">{item.title}</p>
                <p className="mt-1 text-xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className={box}>
              <h2 className="flex items-center gap-2 font-bold">
                <Shield className="h-5 w-5 text-accent-400" />
                Готовность к эфиру
              </h2>
              <ol className="mt-5 space-y-4 text-sm leading-6 text-ink-400">
                <li>1. Подключите бота к своему каналу кнопкой сверху.</li>
                <li>
                  2. При необходимости выдайте боту роль модератора в Twitch:{" "}
                  <code className="text-accent-300">
                    /mod {state?.config?.bot_username || "onewaymod"}
                  </code>
                  .
                </li>
                <li>3. Добавьте команды и проверьте ответ на !help в чате.</li>
              </ol>
            </div>
            <div className={box}>
              <h2 className="font-bold">Всегда на связи</h2>
              <p className="mt-4 text-sm leading-7 text-ink-400">
                Подключением управляет сервер. После подтверждения Twitch бот
                остаётся в чате даже при закрытой странице. Если статус долго не
                меняется, проверьте журнал или обратитесь к администратору.
              </p>
              <button
                onClick={() => setTab("commands")}
                className="mt-5 text-sm font-semibold text-accent-300"
              >
                Настроить команды →
              </button>
            </div>
          </div>
        </>
      )}
      {tab === "commands" && (
        <div className="space-y-5">
          <div className={box}>
            <h2 className="font-bold">Новая команда</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const result = await supabase
                    .from("bot_commands")
                    .insert({
                      owner_id: user.id,
                      name: name.replace(/^!/, "").toLowerCase(),
                      response,
                      cooldown,
                    });
                  if (result.error)
                    throw new Error(
                      "Не удалось добавить команду. Проверьте имя и отсутствие дубликата.",
                    );
                  setName("");
                  setResponse("");
                });
              }}
              className="mt-5 grid gap-3 sm:grid-cols-[1fr_2fr_100px_auto]"
            >
              <input
                aria-label="Имя команды"
                placeholder="!discord"
                pattern="!?[a-zA-Z0-9_]{1,32}"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={input}
              />
              <input
                aria-label="Ответ команды"
                placeholder="Ответ бота, можно использовать {user}"
                maxLength={450}
                required
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                className={input}
              />
              <input
                aria-label="Пауза между ответами в секундах"
                type="number"
                min={5}
                max={3600}
                value={cooldown}
                onChange={(e) => setCooldown(Number(e.target.value))}
                className={input}
              />
              <button
                disabled={busy}
                className="rounded-xl bg-accent-500 p-3"
                aria-label="Добавить команду"
              >
                <Plus className="h-5 w-5" />
              </button>
            </form>
          </div>
          <div className={box}>
            <h2 className="mb-4 font-bold">Команды канала</h2>
            {commands.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-4 border-t border-ink-800 py-4"
              >
                <code className="text-accent-300">!{c.name}</code>
                <p className="min-w-0 flex-1 break-words text-sm text-ink-400">
                  {c.response}
                </p>
                <span className="text-xs text-ink-500">{c.cooldown} сек.</span>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const result = await supabase
                        .from("bot_commands")
                        .update({ enabled: !c.enabled })
                        .eq("id", c.id)
                        .eq("owner_id", user.id);
                      if (result.error) throw result.error;
                    })
                  }
                  aria-pressed={c.enabled}
                  className="text-sm text-accent-300"
                >
                  {c.enabled ? "Включена" : "Выключена"}
                </button>
                <button
                  disabled={busy}
                  aria-label={`Удалить !${c.name}`}
                  onClick={() =>
                    void run(async () => {
                      const result = await supabase
                        .from("bot_commands")
                        .delete()
                        .eq("id", c.id)
                        .eq("owner_id", user.id);
                      if (result.error) throw result.error;
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 text-ink-500" />
                </button>
              </div>
            ))}
            <p className="mt-4 text-xs text-ink-500">
              Встроенные команды: !help, !test, !uptime. Своя команда с таким
              именем заменяет встроенную.
            </p>
          </div>
        </div>
      )}
      {(tab === "chat" || tab === "logs") && (
        <div className={box}>
          <h2 className="font-bold">
            {tab === "chat" ? "Чат канала" : "События и диагностика"}
          </h2>
          <div className="mt-5 h-96 space-y-2 overflow-y-auto rounded-xl bg-ink-950/70 p-4">
            {messages
              .filter((m) =>
                tab === "chat"
                  ? m.kind === "chat" || m.kind === "sent"
                  : m.kind !== "chat",
              )
              .map((m) => (
                <p key={m.id} className="break-words text-sm">
                  <time className="mr-3 text-xs text-ink-600">
                    {new Date(m.created_at).toLocaleTimeString()}
                  </time>
                  <span className="mr-2 font-semibold text-accent-300">
                    {m.username}
                  </span>
                  <span className="text-ink-300">{m.message}</span>
                </p>
              ))}
            {messages.length === 0 && (
              <p className="py-12 text-center text-sm text-ink-500">
                Новые сообщения появятся после подключения бота.
              </p>
            )}
          </div>
          {tab === "chat" && (
            <form
              className="mt-4 flex gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await callEdge("twitch-bot-auth", {
                    action: "send",
                    message,
                  });
                  setMessage("");
                  setNotice(
                    "Сообщение поставлено в очередь. Результат отправки появится в журнале.",
                  );
                });
              }}
            >
              <input
                aria-label="Сообщение в чат"
                placeholder="Сообщение от бота…"
                maxLength={450}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={input}
              />
              <button
                disabled={!online || busy || !message.trim()}
                className="rounded-xl bg-accent-500 px-4 disabled:opacity-40"
                aria-label="Отправить"
              >
                <Send className="h-5 w-5" />
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
