import { useState } from "react";
import {
  ArrowUpRight,
  RefreshCw,
  Radio,
  Users,
  Activity,
  Clock,
  Video,
  MessageSquare,
  Heart,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Profile } from "@/lib/supabase";
import { useChannelAnalytics } from "@/lib/useChannelAnalytics";

const number = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(
        value,
      );
const date = (value: string) =>
  new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const panel = "rounded-2xl border border-ink-800 bg-ink-900/50 p-5 sm:p-6";

export function Statistics({
  channelProfile,
  compact = false,
}: {
  channelProfile?: Profile;
  compact?: boolean;
}) {
  const { profile: ownProfile, user, signInWithTwitch } = useAuth();
  const profile = channelProfile ?? ownProfile;
  const data = useChannelAnalytics(profile, !!user && profile?.id === user.id);
  const [tab, setTab] = useState("overview");
  const { snapshot: snap, summary, sessions } = data;
  if (!profile)
    return (
      <section className={`${panel} py-16 text-center`}>
        <Activity className="mx-auto mb-5 h-10 w-10 text-accent-400" />
        <h1 className="text-2xl font-bold">Ваш канал в цифрах</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-400">
          Войдите через Twitch, чтобы увидеть эфиры, сообщество, клипы и
          доступные показатели канала.
        </p>
        <button
          onClick={signInWithTwitch}
          className="mt-6 rounded-xl bg-accent-500 px-6 py-3 font-semibold"
        >
          Войти через Twitch
        </button>
      </section>
    );
  const metrics = [
    {
      label: "Фолловеры",
      value:
        snap?.followers ?? summary?.followers ?? profile.twitch_follower_count,
      hint: "Текущее число на Twitch",
      icon: Heart,
    },
    {
      label: "Средний онлайн",
      value: summary?.avg_viewers_30d,
      hint: "По замерам за 30 дней",
      icon: Activity,
    },
    {
      label: "Пиковый онлайн",
      value: summary?.peak_viewers_30d,
      hint: "Максимум среди замеров",
      icon: Radio,
    },
    {
      label: "Часов эфира",
      value: summary?.hours_streamed_30d,
      hint: "Наблюдаемые эфиры · 30 дней",
      icon: Clock,
    },
    {
      label: "Эфиров",
      value: summary?.streams_30d,
      hint: "Наблюдаемые эфиры · 30 дней",
      icon: Video,
    },
    {
      label: "Чаттеров",
      value: summary?.chatters_30d,
      hint: "Уникальные авторы · 30 дней",
      icon: Users,
    },
    {
      label: "Сообщений",
      value: summary?.messages_30d,
      hint: "Собрано ботом · 30 дней",
      icon: MessageSquare,
    },
    {
      label: "Подписчиков",
      value: snap?.subscribers,
      hint: "Платные и подарочные подписки",
      icon: Heart,
    },
  ];
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.24em] text-accent-400">
            Канал в цифрах / последние 30 дней
          </p>
          <h1 className={`${compact ? "text-2xl" : "text-4xl"} mt-3 font-bold`}>
            {compact
              ? "Статистика канала"
              : `За кадром ${profile.twitch_display_name || profile.twitch_username}`}
          </h1>
        </div>
        {profile.id === user?.id && (
          <button
            disabled={data.syncing}
            onClick={() => void data.refresh()}
            className="flex items-center gap-2 rounded-xl border border-ink-700 px-4 py-2.5 text-sm disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${data.syncing ? "animate-spin" : ""}`}
            />
            {data.syncing ? "Обновление…" : "Обновить"}
          </button>
        )}
      </div>
      {!compact && (
        <div
          className={`${panel} relative overflow-hidden bg-gradient-to-br from-accent-500/10 to-ink-950`}
        >
          <div className="flex flex-wrap items-center gap-5">
            {profile.twitch_avatar && (
              <img
                src={profile.twitch_avatar}
                alt=""
                className="h-20 w-20 rounded-2xl"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-widest text-ink-400">
                TWITCH ·{" "}
                {snap?.channel?.broadcaster_language ||
                  profile.twitch_channel_language ||
                  "—"}
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {snap?.stream?.title ||
                  snap?.channel?.title ||
                  profile.twitch_stream_title ||
                  profile.twitch_display_name}
              </h2>
              <p className="mt-2 text-sm text-ink-400">
                {profile.twitch_description ||
                  "Эфиры, чат и история вашего сообщества."}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${snap?.stream ? "bg-red-500/15 text-red-300" : "bg-ink-800 text-ink-400"}`}
            >
              {snap
                ? snap.stream
                  ? `● LIVE · ${number(snap.stream.viewer_count)}`
                  : "● OFFLINE"
                : "Нет свежих данных"}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(snap?.channel?.tags ?? profile.twitch_stream_tags ?? []).map(
              (tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-ink-700 px-3 py-1 text-xs text-ink-300"
                >
                  {tag}
                </span>
              ),
            )}
            <a
              href={`https://twitch.tv/${profile.twitch_username}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex items-center gap-1 text-sm text-accent-300"
            >
              На канал
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
      {data.error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-200"
        >
          {data.error}
        </div>
      )}
      <div className="flex flex-wrap gap-4 text-xs text-ink-500">
        <span>
          {data.loading
            ? "Загрузка сохранённых данных…"
            : snap?.updated_at
              ? `Обновлено ${date(snap.updated_at)}`
              : "Данные ещё не собраны"}
        </span>
        <span>Время: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className={panel}>
            <div className="flex items-center justify-between gap-2 text-sm text-ink-400">
              {m.label}
              <m.icon className="h-4 w-4 shrink-0 text-accent-400" />
            </div>
            <p className="mt-5 text-3xl font-bold tabular-nums">
              {number(m.value)}
            </p>
            <p className="mt-2 text-[11px] leading-5 text-ink-500">{m.hint}</p>
          </div>
        ))}
      </div>
      <p className="text-xs leading-6 text-ink-500">
        История собирается с момента подключения. Прочерк — данных нет. Онлайн
        рассчитан по наблюдениям, а не по просмотрам видео; пропуски наблюдений
        могут снижать точность.
      </p>
      {!!snap?.warnings?.length && (
        <details className="text-sm text-ink-400">
          <summary className="cursor-pointer">
            Доступность источников ({snap.warnings.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {snap.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      {!compact && (
        <>
          <nav aria-label="Разделы статистики" className="flex flex-wrap gap-2">
            {[
              ["overview", "Обзор"],
              ["videos", "Записи эфиров"],
              ["clips", "Клипы"],
              ["calendar", "Календарь"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === key ? "bg-accent-500 text-white" : "border border-ink-800 text-ink-400"}`}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "overview" && (
            <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
              <div className={panel}>
                <h2 className="mb-5 text-lg font-bold">Последние эфиры</h2>
                {sessions.length ? (
                  <div className="space-y-3">
                    {sessions.slice(0, 8).map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-4 rounded-xl bg-ink-950/60 p-4"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-ink-500">
                            {date(s.started_at)}
                          </p>
                          <p className="mt-1 truncate font-semibold">
                            {s.title || "Без названия"}
                          </p>
                          <p className="mt-1 text-xs text-ink-400">
                            {s.game_name || "Категория неизвестна"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-bold">
                            {number(s.peak_viewers)}
                          </p>
                          <p className="text-[11px] text-ink-500">
                            пик зрителей
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty text="Наблюдаемых эфиров ещё нет. Архивы находятся во вкладке «Записи эфиров»." />
                )}
              </div>
              <div className="space-y-5">
                <div className={panel}>
                  <h2 className="text-lg font-bold">Пульс канала</h2>
                  <div className="mt-5 space-y-5">
                    {[
                      [
                        "Категория",
                        snap?.channel?.game_name || profile.twitch_game_name,
                      ],
                      [
                        "Название эфира",
                        snap?.channel?.title || profile.twitch_stream_title,
                      ],
                      [
                        "Начало текущего эфира",
                        snap?.stream?.started_at
                          ? date(snap.stream.started_at)
                          : null,
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="border-l-2 border-accent-500/40 pl-4"
                      >
                        <p className="text-xs text-ink-500">{label}</p>
                        <p className="mt-1 text-sm">{value || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={panel}>
                  <h2 className="font-bold">Онлайн последних эфиров</h2>
                  <div className="mt-5 space-y-3">
                    {sessions
                      .filter((s) => s.peak_viewers != null)
                      .slice(0, 6)
                      .map((s) => (
                        <div key={s.id}>
                          <div className="mb-1 flex justify-between text-xs text-ink-400">
                            <span>{date(s.started_at)}</span>
                            <span>{number(s.peak_viewers)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-ink-800">
                            <div
                              className="h-2 rounded-full bg-accent-400"
                              style={{
                                width: `${Math.max(1, ((s.peak_viewers ?? 0) / Math.max(1, ...sessions.map((row) => row.peak_viewers ?? 0))) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    {!sessions.some((s) => s.peak_viewers != null) && (
                      <Empty text="График появится после первых замеров." />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {(tab === "videos" || tab === "clips") && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(tab === "videos"
                ? (snap?.videos ?? [])
                : (snap?.clips ?? [])
              ).map((v) => (
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  key={v.id}
                  className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/50 transition hover:border-accent-400/50"
                >
                  {v.thumbnail_url && (
                    <img
                      loading="lazy"
                      src={v.thumbnail_url
                        .replace("%{width}", "480")
                        .replace("%{height}", "270")}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="line-clamp-2 font-semibold">{v.title}</h3>
                    <p className="mt-3 text-xs text-ink-400">
                      {number(v.view_count)} просмотров
                      {"duration" in v
                        ? ` · ${v.duration}`
                        : ` · ${v.creator_name}`}
                    </p>
                  </div>
                </a>
              ))}
              {!(tab === "videos"
                ? snap?.videos?.length
                : snap?.clips?.length) && (
                <Empty text="Нет доступных публикаций или источник пока не обновлён." />
              )}
            </div>
          )}
          {tab === "calendar" && (
            <div className={panel}>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <CalendarDays className="h-5 w-5 text-accent-400" />
                Расписание Twitch
              </h2>
              <div className="mt-5 space-y-3">
                {snap?.schedule?.length ? (
                  snap.schedule.map((s) => (
                    <div key={s.id} className="rounded-xl bg-ink-950/50 p-4">
                      <p className="text-xs text-accent-300">
                        {date(s.start_time)} — {date(s.end_time)}
                      </p>
                      <h3 className="mt-2 font-semibold">
                        {s.title || "Запланированный эфир"}
                      </h3>
                      <p className="mt-1 text-sm text-ink-400">
                        {s.canceled_until
                          ? "Отменён"
                          : s.category?.name || "Без категории"}
                      </p>
                    </div>
                  ))
                ) : (
                  <Empty text="Канал не опубликовал расписание или оно недоступно." />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-8 text-sm leading-6 text-ink-500">{text}</p>;
}
